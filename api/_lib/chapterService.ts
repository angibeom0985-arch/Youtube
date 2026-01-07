import { GoogleGenAI, Type } from "@google/genai";
import type { AnalysisResult, Chapter, ScriptLine, StructuredContent } from "../../types.js";

const createAI = (apiKey: string) => {
  return new GoogleGenAI({ apiKey });
};

// 챕터 기반 개요 생성 (긴 영상용)
export const generateChapterOutline = async (
  analysis: AnalysisResult,
  newKeyword: string,
  length: string,
  category: string,
  apiKey: string,
  vlogType?: string,
  scriptStyle?: string  // "대화 버전" | "나레이션 버전"
): Promise<{ chapters: Chapter[]; characters: string[]; newIntent: StructuredContent[] }> => {
  try {
    const ai = createAI(apiKey);

    const isStoryChannel = category === "썰 채널";
    const isNorthKoreaChannel = category === "북한 이슈";
    const is49Channel = category === "49금";
    const isYadamChannel = category === "야담";
    const isGukppongChannel = category === "국뽕";

    // 목표 영상 길이에 따른 챕터 수 결정
    // 토큰 제한: Gemini API 출력 약 8,192 토큰 (한국어 대본 약 1분당 150-200 토큰)
    
    // 영상 길이를 분 단위로 변환
    const parseMinutes = (lengthStr: string): number => {
      let totalMinutes = 0;
      
      // "1시간 30분", "90분", "1시간", "2시간 15분 30초" 등 다양한 형식 지원
      const hourMatch = lengthStr.match(/(\d+)\s*시간/);
      const minuteMatch = lengthStr.match(/(\d+)\s*분/);
      
      if (hourMatch) {
        totalMinutes += parseInt(hourMatch[1]) * 60;
      }
      if (minuteMatch) {
        totalMinutes += parseInt(minuteMatch[1]);
      }
      
      // 시간/분 단위가 없으면 분으로 간주
      if (!hourMatch && !minuteMatch) {
        const numMatch = lengthStr.match(/(\d+)/);
        if (numMatch) {
          totalMinutes = parseInt(numMatch[1]);
        }
      }
      
      return totalMinutes;
    };
    
    const totalMinutes = parseMinutes(length);
    
    // 챕터당 목표 시간: 3.75분 (대본 길이 2배 증가로 인해)
    const chapterDuration = 3.75;
    let targetChapters = Math.ceil(totalMinutes / chapterDuration);
    
    // 최소 2챕터로 제한 (8분 영상도 챕터 2개)
    targetChapters = Math.max(2, targetChapters);

    const chapterSchema = {
      type: Type.OBJECT,
      properties: {
        newIntent: {
          type: Type.ARRAY,
          description: "영상의 새로운 기획 의도",
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
            },
            required: ["title", "description"],
          },
        },
        characters: {
          type: Type.ARRAY,
          description: "대본에 등장하는 모든 인물 또는 화자의 목록",
          items: { type: Type.STRING },
        },
        chapters: {
          type: Type.ARRAY,
          description: `영상을 ${targetChapters}개의 챕터로 나눈 개요. 각 챕터는 독립적으로 대본을 생성할 수 있는 단위입니다.`,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "챕터 고유 ID (chapter-1, chapter-2 등)" },
              title: { type: Type.STRING, description: "챕터 제목" },
              purpose: { type: Type.STRING, description: "이 챕터의 목적과 핵심 내용" },
              estimatedDuration: { type: Type.STRING, description: "예상 소요 시간 (예: '8분')" },
            },
            required: ["id", "title", "purpose", "estimatedDuration"],
          },
        },
      },
      required: ["newIntent", "characters", "chapters"],
    };

    const analysisString = JSON.stringify(
      {
        keywords: analysis.keywords,
        intent: analysis.intent,
        scriptStructure: analysis.scriptStructure?.map((stage) => ({
          stage: stage.stage,
          purpose: stage.purpose,
        })),
      },
      null,
      2
    );

    let categoryGuideline = "";
    if (isStoryChannel || is49Channel || isNorthKoreaChannel || isYadamChannel || isGukppongChannel) {
      categoryGuideline = `
**스토리 구조 가이드:**
- 챕터 1: 도입부 (후크, 배경 설정)
- 챕터 2-3: 전개 (사건 발생, 갈등 심화)
- 챕터 ${targetChapters - 2}: 절정 (가장 극적인 순간)
- 챕터 ${targetChapters - 1}: 해결 (갈등 해소)
- 챕터 ${targetChapters}: 결말 (교훈, 마무리)`;
    }

    const prompt = `"${newKeyword}"를 주제로 한 ${length} 분량의 영상 개요를 챕터별로 나누어 생성해주세요.

**중요**: 전체 영상을 ${targetChapters}개의 챕터로 나누되, 각 챕터는 나중에 개별적으로 상세 대본을 생성할 수 있도록 명확한 목적과 내용을 가져야 합니다.

${categoryGuideline}

**각 챕터 작성 지침:**
1. 각 챕터의 예상 소요 시간을 명시하세요 (전체 ${length}이 되도록 분배)
2. 각 챕터의 핵심 내용과 목적을 명확히 서술하세요
3. 챕터 간의 자연스러운 흐름과 연결성을 고려하세요
4. 스토리의 긴장감과 흥미가 지속되도록 구성하세요

**참고용 분석 자료:**
${analysisString}

모든 결과를 JSON 형식으로 제공해주세요.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: chapterSchema,
        temperature: 0.9,
        maxOutputTokens: 8000,
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
  } catch (error: any) {
    console.error("Error generating chapter outline:", error);
    throw new Error(`챕터 개요 생성 중 오류가 발생했습니다: ${error.message}`);
  }
};

// 특정 챕터의 상세 대본 생성
export const generateChapterScript = async (
  chapter: Chapter,
  characters: string[],
  newKeyword: string,
  category: string,
  apiKey: string,
  allChapters: Chapter[],
  scriptStyle?: string  // "대화 버전" | "나레이션 버전"
): Promise<ScriptLine[]> => {
  try {
    const ai = createAI(apiKey);

    const isNarration = scriptStyle === "나레이션 버전";

    const scriptSchema = {
      type: Type.OBJECT,
      properties: {
        script: {
          type: Type.ARRAY,
          description: "이 챕터의 상세한 대본",
          items: {
            type: Type.OBJECT,
            properties: {
              character: { type: Type.STRING, description: "화자" },
              line: { type: Type.STRING, description: "대사" },
              timestamp: { type: Type.STRING, description: "타임스탬프 (MM:SS)" },
              imagePrompt: { type: Type.STRING, description: "이미지 생성 프롬프트 (영어)" },
            },
            required: ["character", "line", "timestamp", "imagePrompt"],
          },
        },
      },
      required: ["script"],
    };

    // 이전 챕터들의 요약
    const previousChaptersSummary = allChapters
      .filter((ch) => parseInt(ch.id.split('-')[1]) < parseInt(chapter.id.split('-')[1]))
      .map((ch) => `- ${ch.title}: ${ch.purpose}`)
      .join('\n');

    // 다음 챕터들의 요약
    const nextChaptersSummary = allChapters
      .filter((ch) => parseInt(ch.id.split('-')[1]) > parseInt(chapter.id.split('-')[1]))
      .map((ch) => `- ${ch.title}: ${ch.purpose}`)
      .join('\n');

    const isStoryChannel = category === "쇼 채널" || category === "북한 이슈" || category === "49금" || category === "야담" || category === "국뽕";

    const styleGuideline = isNarration
      ? `5. **나레이션 스타일**: 단독 나레이터가 이야기하는 형식으로 작성하세요
   - character는 항상 "나레이터"로 통일
   - 설명하는 투의 문체 사용
   - 예: "나레이터: 그날 밤, 그는 어두운 갤러리 앞에 서 있었습니다..."

6. **이미지 프롬프트**: 각 장면을 시각적으로 표현할 수 있는 영어 프롬프트를 작성하세요
   - 주요 인물, 장소, 행동, 분위기 포함
   - 예: "A man standing in front of an art gallery at night, mysterious atmosphere"`
      : `5. **대화 스타일**: 등장인물 간의 대화로 이야기를 전개하세요
   - character에 지정된 등장인물 이름 사용
   - 자연스러운 대화체 문체
   - 예: "주인공: 여기가 그 유명한 갤러리군요"

6. **이미지 프롬프트**: 각 장면을 시각적으로 표현할 수 있는 영어 프롬프트를 작성하세요
   - 주요 인물, 장소, 행동, 분위기 포함
   - 예: "A man standing in front of an art gallery at night, mysterious atmosphere"`;

    const prompt = `"${newKeyword}" 주제의 다음 챕터에 대한 상세 대본을 작성해주세요:

**현재 챕터 정보:**
- 제목: ${chapter.title}
- 목적: ${chapter.purpose}
- 예상 시간: ${chapter.estimatedDuration}

**등장인물:** ${characters.join(', ')}

${previousChaptersSummary ? `**이전 챕터 요약:**\n${previousChaptersSummary}\n` : ''}
${nextChaptersSummary ? `**다음 챕터 예정:**\n${nextChaptersSummary}\n` : ''}

**대본 작성 지침:**
1. **분량 (중요!)**: 이 챕터의 예상 시간(${chapter.estimatedDuration})에 맞는 **풍부하고 상세한 대사**를 작성하세요
   - 한국어 낭독 속도: 분당 약 600-700자 (기존의 2배)
   - **대사 개수: 최소 ${Math.ceil(parseInt(chapter.estimatedDuration) * 8)}개 이상** (기존의 2배)
   - 각 대사는 충분히 길고 상세하게 작성하여 시청자가 몰입할 수 있도록 구성하세요
2. **흐름**: 이전 챕터와 자연스럽게 연결되고, 다음 챕터로 이어지도록 구성하세요
3. **등장인물**: ${isNarration ? '"나레이터"만 사용하세요' : '지정된 등장인물만 사용하세요'}
4. **타임스탬프**: 각 대사의 예상 시점을 MM:SS 형식으로 정확히 계산하세요
${styleGuideline}

${isStoryChannel ? `
**스토리 요소:**
- 대화를 통한 자연스러운 전개
- 캐릭터 간의 상호작용
- 감정선과 긴장감 유지
- 적절한 페이스 조절` : ''}

모든 결과를 JSON 형식으로 제공해주세요.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: scriptSchema,
        temperature: 0.9,
        maxOutputTokens: 8000,
      },
    });

    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    return result.script;
  } catch (error: any) {
    console.error("Error generating chapter script:", error);
    throw new Error(`챕터 대본 생성 중 오류가 발생했습니다: ${error.message}`);
  }
};
