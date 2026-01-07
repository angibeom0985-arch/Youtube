import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, NewPlan } from "../../types.js";

const createAI = (apiKey: string) => {
  return new GoogleGenAI({ apiKey });
};

// API 키 검증 함수
export const validateApiKey = async (apiKey: string): Promise<boolean> => {
  try {
    const ai = createAI(apiKey);
    // 간단한 테스트 요청으로 API 키 검증
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Hello",
      config: {
        maxOutputTokens: 10,
      },
    });

    // 응답이 있으면 유효한 키
    return !!response.text;
  } catch (error) {
    console.error("API key validation failed:", error);
    return false;
  }
};

const structuredContentSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "The title of the section." },
      description: {
        type: Type.STRING,
        description:
          "The detailed content of the section. To ensure high readability, create clear separation between points using double line breaks instead of Markdown lists. Use `**bold text**` to emphasize important keywords or subheadings.",
      },
    },
    required: ["title", "description"],
  },
};

const baseAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    keywords: {
      type: Type.ARRAY,
      description: "A list of 5-10 core keywords from the video, in Korean.",
      items: { type: Type.STRING },
    },
    intent: {
      ...structuredContentSchema,
      description:
        "영상의 기획 의도를 '목표 시청자', '핵심 메시지', '기대 효과' 등의 섹션으로 나누어 구조적으로 분석합니다. 각 설명은 가독성을 높이기 위해, 글머리 기호(-) 대신 문단 사이에 두 번의 줄바꿈을 사용해 공백을 확보하고, 중요한 키워드는 **굵은 글씨**로 강조해주세요.",
    },
    viewPrediction: {
      ...structuredContentSchema,
      description:
        "이 영상의 조회수가 높은 이유를 '감정적 연결', '사회적 공감대', '콘텐츠 구조' 등의 섹션으로 나누어 구조적으로 분석합니다. 여러 항목을 나열할 때는 반드시 글머리 기호(-) 대신 문단 사이에 두 번의 줄바꿈을 사용하여 가독성을 극대화하고, 중요한 소제목은 **굵은 글씨**로 강조해주세요.",
    },
  },
  required: ["keywords", "intent", "viewPrediction"],
};

const storyChannelAnalysisSchema = {
  ...baseAnalysisSchema.properties,
  scriptStructure: {
    type: Type.ARRAY,
    description:
      "A step-by-step breakdown of the script's structure. Each step should have a title, purpose, and example quotes from the transcript, in Korean.",
    items: {
      type: Type.OBJECT,
      properties: {
        stage: {
          type: Type.STRING,
          description:
            "The stage of the script (e.g., '1단계: 시선 끌기 및 문제/기회 제기').",
        },
        purpose: {
          type: Type.STRING,
          description:
            "The goal of this stage (e.g., '목적 (무엇을 판단/생산할지)').",
        },
        quotes: {
          type: Type.ARRAY,
          description:
            "스크립트에서 이 단계를 가장 잘 보여주는 직접적인 인용구입니다. 각 인용구에는 대사가 나오는 시간(타임스탬프, 예: '01:23')을 반드시 포함해야 합니다. 스크립트에 타임스탬프가 없다면, 영상의 전체 길이를 고려하여 예상 시간을 MM:SS 형식으로 기재해주세요.",
          items: {
            type: Type.OBJECT,
            properties: {
              timestamp: {
                type: Type.STRING,
                description: "인용구의 타임스탬프 (MM:SS 형식).",
              },
              text: { type: Type.STRING, description: "인용구의 내용." },
            },
            required: ["timestamp", "text"],
          },
        },
      },
      required: ["stage", "purpose", "quotes"],
    },
  },
};

const newPlanBaseSchema = {
  newIntent: {
    ...structuredContentSchema,
    description:
      "새로운 영상의 기획 의도를 '목표', '핵심 컨셉', '시청자에게 줄 가치' 등의 섹션으로 나누어 구조적으로 작성합니다. 각 설명은 가독성을 높이기 위해, 글머리 기호(-) 대신 문단 사이에 두 번의 줄바꿈을 사용해 공백을 확보하고, 중요한 키워드는 **굵은 글씨**로 강조해주세요.",
  },
};

const storyChannelNewPlanSchema = {
  type: Type.OBJECT,
  properties: {
    ...newPlanBaseSchema,
    characters: {
      type: Type.ARRAY,
      description:
        "대본에 등장하는 모든 인물 또는 화자의 목록입니다. (예: '나레이터', '출연자 A')",
      items: { type: Type.STRING },
    },
    scriptWithCharacters: {
      type: Type.ARRAY,
      description:
        "새로운 영상에 대한 상세한, 한 줄 한 줄의 대본입니다. 각 객체는 화자, 대사, 타임스탬프(예상 시간), 그리고 해당 장면에 대한 이미지 생성 프롬프트를 포함해야 합니다.",
      items: {
        type: Type.OBJECT,
        properties: {
          character: {
            type: Type.STRING,
            description: "이 대사를 말하는 인물 또는 화자입니다.",
          },
          line: {
            type: Type.STRING,
            description:
              "이 대사의 대화 또는 행동입니다. 마크다운 사용이 가능합니다.",
          },
          timestamp: {
            type: Type.STRING,
            description:
              "이 대사가 등장할 예상 시간 (MM:SS 형식, 예: '00:15', '01:30'). **중요**: 한국어 낭독 속도는 **분당 약 300-350자(약 5-6자/초)**입니다. 각 대사의 글자 수를 세고, 이전 대사들의 누적 시간을 더해 정확한 타임스탬프를 계산하세요. 예를 들어, 50자 대사는 약 8-10초가 소요됩니다. 대사 사이에 자연스러운 호흡(1-2초)도 고려하세요.",
          },
          imagePrompt: {
            type: Type.STRING,
            description:
              "이 대사와 장면에 어울리는 이미지를 생성하기 위한 상세한 프롬프트입니다. DALL-E 또는 Midjourney와 같은 이미지 생성 AI에 사용할 수 있도록 영어로 작성해주세요.\n\n**범용 프롬프트 구조 (Universal Prompt Skeleton)**:\n{Style}, {Composition} of {Subject}, {Action}, in {Background}, with {Lighting}, {Mood}, {Quality}\n\n- {Style}: 카테고리 특성 반영 스타일 (예: cinematic photo, digital art, candid vlog style)\n- {Composition}: 구도와 앵글 (예: close-up shot, wide angle, full body shot)\n- {Subject}: 대본에서 추출한 인물/사물 상세 묘사 (예: a young woman with long brown hair)\n- {Action}: 인물의 행동/상황 (예: reading a book, looking at city view)\n- {Background}: 장면 배경 (예: cozy living room, bustling street at night)\n- {Lighting}: 조명 효과 (예: soft natural light, dramatic neon lighting)\n- {Mood}: 전체 분위기 (예: peaceful and serene, mysterious and tense)\n- {Quality}: 품질 키워드 (예: highly detailed, 8K, photorealistic)\n\n**중요**: 실제 사진 스타일보다는 illustration style, digital art, anime style, webtoon style 등 AI가 생성하기 쉬운 예술적 스타일을 우선적으로 사용하세요.",
          },
        },
        required: ["character", "line", "timestamp", "imagePrompt"],
      },
    },
  },
  required: ["newIntent", "characters", "scriptWithCharacters"],
};

const structuredOutlinePlanSchema = {
  type: Type.OBJECT,
  properties: {
    ...newPlanBaseSchema,
    scriptOutline: {
      type: Type.ARRAY,
      description:
        "A step-by-step breakdown of the new video's outline. Each step should have a title, purpose, and detailed content, in Korean. Use markdown for the details.",
      items: {
        type: Type.OBJECT,
        properties: {
          stage: {
            type: Type.STRING,
            description: "The stage of the outline (e.g., '1단계: 도입부').",
          },
          purpose: {
            type: Type.STRING,
            description: "The goal of this stage.",
          },
          details: {
            type: Type.STRING,
            description:
              "Detailed content for this stage. To ensure high readability, create clear separation between points using double line breaks instead of Markdown lists. Use `**bold text**` to emphasize important keywords or subheadings.",
          },
        },
        required: ["stage", "purpose", "details"],
      },
    },
  },
  required: ["newIntent", "scriptOutline"],
};

const ideaSchema = {
  type: Type.OBJECT,
  properties: {
    ideas: {
      type: Type.ARRAY,
      description:
        "A list of 5 new video topic ideas or product recommendations, in Korean.",
      items: { type: Type.STRING },
    },
  },
  required: ["ideas"],
};

export const analyzeTranscript = async (
  transcript: string,
  category: string,
  apiKey: string,
  videoTitle?: string
): Promise<AnalysisResult> => {
  try {
    const ai = createAI(apiKey);

    const fullAnalysisSchema = {
      type: Type.OBJECT,
      properties: storyChannelAnalysisSchema,
      required: [...baseAnalysisSchema.required, "scriptStructure"],
    };

    const analysisContext = videoTitle
      ? `다음은 제목이 "${videoTitle}"인 성공적인 '${category}' 카테고리 YouTube 동영상입니다. 영상의 제목과 스크립트를 종합적으로 고려하여 심층적으로 분석하고, 각 항목을 지정된 구조에 맞춰 JSON 형식으로 제공해주세요:`
      : `다음은 성공적인 '${category}' 카테고리 YouTube 동영상의 스크립트입니다. 이 카테고리의 특성을 고려하여 심층적으로 분석하고, 각 항목을 지정된 구조에 맞춰 JSON 형식으로 제공해주세요:`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${analysisContext}\n\n스크립트:\n---\n${transcript}\n---`,
      config: {
        systemInstruction: `당신은 '${category}' 전문 YouTube 콘텐츠 전략가입니다. 당신의 임무는 비디오 스크립트를 분석하고 벤치마킹을 위해 핵심 요소에 대한 구조화된 분석을 제공하는 것입니다. 모든 텍스트 설명은 가독성을 위해 **굵은 글씨**를 활용하고, 글머리 기호(-) 대신 문단 사이에 두 번의 줄바꿈을 사용하여 명확하게 구분해주세요.`,
        responseMimeType: "application/json",
        responseSchema: fullAnalysisSchema,
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as AnalysisResult;
  } catch (error: any) {
    console.error("Error analyzing transcript:", error);
    
    let userMessage = "[오류] 스크립트 분석 중 오류가 발생했습니다.\n\n";
    
    const errorString = JSON.stringify(error);
    const errorMessage = error.message || '';
    
    if (errorString.includes('SERVICE_DISABLED') || errorString.includes('PERMISSION_DENIED') || errorMessage.includes('has not been used in project') || errorMessage.includes('is disabled')) {
      userMessage += "[원인]\n- API 키의 Generative Language API가 비활성화되어 있습니다\n- 또는 API 키가 잘못되었습니다\n\n[해결 방법]\n";
      userMessage += "1. Google AI Studio (aistudio.google.com)에서 새 API 키를 발급받으세요\n";
      userMessage += "2. 기존 API 키를 사용 중이라면, Google Cloud Console에서 'Generative Language API'를 활성화하세요\n";
      userMessage += "3. API 키를 새로 발급받은 경우, 5-10분 정도 기다린 후 다시 시도하세요\n\n";
      userMessage += "[API 키 재발급 방법]\n";
      userMessage += "- https://aistudio.google.com/app/apikey 방문\n";
      userMessage += "- 'Create API key' 버튼 클릭\n";
      userMessage += "- 새 API 키를 복사하여 사용하세요";
    } else if (errorMessage.includes('API_KEY') || errorMessage.includes('invalid') || errorString.includes('INVALID_ARGUMENT')) {
      userMessage += "[원인]\n- API 키가 유효하지 않거나 만료되었습니다\n\n[해결 방법]\n- API 키를 다시 확인하고 재설정해주세요\n- API 키 발급 가이드를 참고하여 새로운 키를 발급받으세요";
    } else if (errorMessage.includes('quota') || errorString.includes('RESOURCE_EXHAUSTED')) {
      userMessage += "[원인]\n- API 사용량이 초과되었습니다\n\n[해결 방법]\n- 잠시 후 다시 시도해주세요\n- Google AI Studio에서 API 사용량을 확인해주세요";
    } else if (errorMessage.includes('rate') || errorString.includes('RATE_LIMIT')) {
      userMessage += "[원인]\n- API 요청이 너무 빠르게 발생했습니다\n\n[해결 방법]\n- 10초 정도 기다린 후 다시 시도해주세요";
    } else {
      userMessage += "[가능한 원인]\n- 스크립트 길이가 너무 길거나 형식이 올바르지 않습니다\n- AI 서버 일시적 오류\n- 네트워크 연결 문제\n\n[해결 방법]\n- 스크립트를 짧게 나눠서 다시 시도해주세요\n- 잠시 후 다시 시도해주세요";
    }
    
    userMessage += `\n\n[개발자 정보]\n${errorMessage || '알 수 없는 오류'}\n${error.stack ? '\nStack: ' + error.stack : ''}`;
    
    throw new Error(userMessage);
  }
};

export const generateIdeas = async (
  analysis: AnalysisResult,
  category: string,
  apiKey: string,
  userKeyword?: string
): Promise<string[]> => {
  try {
    const ai = createAI(apiKey);

    const analysisString = JSON.stringify(
      {
        keywords: analysis.keywords,
        intent: analysis.intent,
      },
      null,
      2
    );

    const isShoppingReview = category === "쇼핑 리뷰";
    const keywordInstruction = userKeyword
      ? `\n\n**중요: 사용자가 원하는 키워드 "${userKeyword}"를 반드시 포함하거나 관련된 아이디어를 생성해주세요.**`
      : "";

    const prompt = isShoppingReview
      ? `다음은 성공적인 '쇼핑 리뷰' 영상 분석 결과입니다. 이 분석을 바탕으로, 한국의 이커머스 사이트 '쿠팡(Coupang)'에서 현재 판매량이 가장 많거나 후기가 많은 제품 중, 영상 리뷰 콘텐츠로 만들기에 적합한 제품 6가지를 추천해주세요. 아이디어는 한국어로 작성하고 JSON 형식의 배열로 제공해주세요.${keywordInstruction}\n\n분석 내용:\n${analysisString}`
      : `다음은 성공적인 유튜브 영상 분석 결과입니다. 이 분석을 바탕으로, 비슷한 성공 가능성이 있는 새롭고 창의적인 영상 주제 아이디어 6가지를 제안해주세요. 아이디어는 한국어로 작성하고 JSON 형식의 배열로 제공해주세요.${keywordInstruction}\n\n분석 내용:\n${analysisString}`;

    const systemInstruction = isShoppingReview
      ? "당신은 최신 트렌드에 밝은 쇼핑 전문가입니다. 성공적인 리뷰 영상을 분석하여, 다음 히트할 만한 리뷰 제품을 추천하는 역할을 합니다."
      : "당신은 트렌드를 잘 읽는 유튜브 콘텐츠 기획자입니다. 성공 사례를 분석하여 새로운 히트 아이디어를 제안하는 역할을 합니다.";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: ideaSchema,
      },
    });

    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    return result.ideas as string[];
  } catch (error: any) {
    console.error("Error generating ideas:", error);
    
    let userMessage = "[오류] 아이디어 생성 중 오류가 발생했습니다.\n\n";
    
    const errorString = JSON.stringify(error);
    const errorMessage = error.message || '';
    
    if (errorString.includes('SERVICE_DISABLED') || errorString.includes('PERMISSION_DENIED') || errorMessage.includes('has not been used in project') || errorMessage.includes('is disabled')) {
      userMessage += "[원인]\n- API 키의 Generative Language API가 비활성화되어 있습니다\n\n[해결 방법]\n";
      userMessage += "1. https://aistudio.google.com/app/apikey 에서 새 API 키를 발급받으세요\n";
      userMessage += "2. 기존 API 키 사용 시, Google Cloud Console에서 'Generative Language API'를 활성화하세요\n";
      userMessage += "3. API 키를 새로 발급받은 경우, 5-10분 정도 기다린 후 다시 시도하세요";
    } else if (errorMessage.includes('API_KEY') || errorMessage.includes('invalid') || errorString.includes('INVALID_ARGUMENT')) {
      userMessage += "[원인]\n- API 키가 유효하지 않거나 만료되었습니다\n\n[해결 방법]\n- API 키를 다시 확인하고 재설정해주세요";
    } else if (errorMessage.includes('quota') || errorString.includes('RESOURCE_EXHAUSTED')) {
      userMessage += "[원인]\n- API 사용량이 초과되었습니다\n\n[해결 방법]\n- 잠시 후 다시 시도해주세요\n- Google AI Studio에서 API 사용량을 확인해주세요";
    } else if (errorMessage.includes('rate') || errorString.includes('RATE_LIMIT')) {
      userMessage += "[원인]\n- API 요청이 너무 빠르게 발생했습니다\n\n[해결 방법]\n- 10초 정도 기다린 후 다시 시도해주세요";
    } else {
      userMessage += "[가능한 원인]\n- AI 서버 일시적 오류\n- 네트워크 연결 문제\n\n[해결 방법]\n- 잠시 후 다시 시도해주세요\n- 새로고침 후 다시 시도해주세요";
    }
    
    userMessage += `\n\n[개발자 정보]\n${errorMessage || '알 수 없는 오류'}\n${error.stack ? '\nStack: ' + error.stack : ''}`;
    
    throw new Error(userMessage);
  }
};

export const generateNewPlan = async (
  analysis: AnalysisResult,
  newKeyword: string,
  length: string,
  category: string,
  apiKey: string,
  vlogType?: string
): Promise<NewPlan> => {
  try {
    const ai = createAI(apiKey);

    // scriptStructure에서 원본 대본의 인용구(quotes)를 제거하여
    // 구조와 목적만 전달하고, 원본 대본 내용이 새 대본에 영향을 주지 않도록 함
    const cleanedScriptStructure = analysis.scriptStructure?.map((stage) => ({
      stage: stage.stage,
      purpose: stage.purpose,
      // quotes는 제거 - 원본 대본 내용 누출 방지
    }));

    const analysisString = JSON.stringify(
      {
        keywords: analysis.keywords,
        intent: analysis.intent,
        scriptStructure: cleanedScriptStructure,
      },
      null,
      2
    );

    const isStoryChannel = category === "썰 채널";
    const isVlogChannel = category === "브이로그";
    const is49Channel = category === "49금";
    const isYadamChannel = category === "야담";
    const isMukbangChannel = category === "먹방";
    const isGukppongChannel = category === "국뽕";
    const isNorthKoreaChannel = category === "북한 이슈";
    const schema =
      isStoryChannel || is49Channel || isYadamChannel || isGukppongChannel || isNorthKoreaChannel
        ? storyChannelNewPlanSchema
        : structuredOutlinePlanSchema;

    let contents;
    
    // 영상 길이에 따른 최소 대본 라인 수 계산
    const getMinimumLines = (lengthStr: string): number => {
      if (lengthStr.includes('1시간') || lengthStr.includes('60분')) return 200;
      if (lengthStr.includes('30분')) return 100;
      if (lengthStr.includes('8분')) return 30;
      return 30;
    };
    
    const minimumLines = getMinimumLines(length);
    const lengthGuideline = length.includes('1시간') || length.includes('60분')
      ? `\n\n**⚠️ 중요: 영상 길이 가이드 (${length})**\n- 최소 ${minimumLines}개 이상의 대사 라인을 생성해야 합니다\n- 1시간 = 약 18,000-21,000자 분량 (한국어 낭독 속도 기준)\n- 각 대사는 자연스러운 대화 길이로 작성하되, 전체 스토리가 ${length} 분량에 맞도록 충분히 상세하게 작성하세요\n- 장면 전환, 복선, 클라이맥스 등 스토리 요소를 풍부하게 포함하세요\n- 대사 사이의 자연스러운 간격과 감정 표현도 충분히 담아주세요`
      : `\n\n**영상 길이 가이드 (${length})**: 최소 ${minimumLines}개 이상의 대사 라인을 생성하세요.`;
    
    if (isStoryChannel) {
      contents = `"${newKeyword}"를 주제로 한 완전히 새로운 스토리 영상 기획안을 만들어 주세요. 목표 영상 길이는 약 ${length}입니다.${lengthGuideline}

**절대 규칙:**
- 아래 제공된 분석 자료의 **대본 구조(단계별 흐름)**만 참고하세요
- 원본 영상의 등장인물, 상황, 배경, 대사는 절대 사용하지 마세요
- "${newKeyword}"를 중심으로 완전히 새로운 인물, 상황, 스토리를 창작하세요

**중요: 배역 구성 지침**
- '나레이터'만 사용하지 말고, 스토리에 어울리는 다양한 배역을 만들어주세요.
- 배역 예시: 주인공, 친구, 상대방, 엄마, 아빠, 선생님, 동료, 후배, 선배, 지인, 사장님 등
- 스토리의 맥락에 맞는 2~5명의 캐릭터를 등장시켜 대화형 형식으로 작성해주세요.
- 각 캐릭터는 구체적인 역할명(예: '나', '친구 민수', '엄마', '회사 동료')을 사용해주세요.
- 나레이션이 필요한 경우에만 '나레이터'를 사용하되, 대부분의 내용은 캐릭터 간의 대화와 행동으로 표현해주세요.

각 대사마다 해당 장면을 시각적으로 묘사하는 상세한 이미지 생성 프롬프트('imagePrompt')를 반드시 포함해야 합니다.

**이미지 프롬프트 작성 가이드 - 썰 채널 스타일**:
- 핵심 키워드: cinematic, dramatic lighting, moody, mysterious, suspenseful, narrative still
- 스타일 강조: 영화의 한 장면처럼 극적이고 서사적인 느낌
- 조명과 분위기에 집중하여 긴장감 조성
- 예시: "cinematic shot of a person in shock, dramatic lighting, moody atmosphere, mysterious background, highly detailed, film noir style"

**참고용 대본 구조 (구조만 차용, 내용은 절대 사용 금지):**

${analysisString}

위 구조의 단계별 흐름(예: 도입→전개→절정→결말)만 참고하여, "${newKeyword}"를 주제로 완전히 새로운 스토리를 창작해주세요. 모든 결과 항목을 지정된 구조에 맞춰 JSON 형식으로 제공해주세요.`;
    } else if (isVlogChannel) {
      const vlogTypePrompts: Record<string, string> = {
        "모닝 루틴":
          "아침 시간대의 루틴을 중심으로, 기상부터 외출 준비까지의 과정을 자연스럽게 보여주세요. 건강한 습관, 아침 식사, 메이크업/스타일링, 출근/등교 준비 등을 포함하세요.",
        다이어트:
          "다이어트 여정과 일상을 담아주세요. 식단 관리, 운동 루틴, 체중/체형 변화, 건강한 습관 만들기, 동기부여와 목표 달성 과정을 솔직하게 공유하세요.",
        여행: "여행지 탐방과 경험을 중심으로 구성하세요. 이동 과정, 명소 방문, 로컬 음식, 숙소 투어, 여행 팁을 자연스럽게 녹여내세요.",
        언박싱:
          "새로 구매한 제품들을 언박싱하고 소개하는 과정을 담아주세요. 구매 동기, 가격, 착용/사용 후기를 솔직하게 전달하세요.",
        패션: "패션과 스타일링을 중심으로 구성하세요. 코디 아이디어, OOTD, 쇼핑 하울, 스타일링 팁, 트렌드 소개를 감각적으로 담아주세요.",
        공부: "공부하는 모습과 학습 방법을 보여주세요. 책상 세팅, 공부 타임랩스, 집중력 유지 팁, 휴식 시간을 자연스럽게 구성하세요.",
        운동: "운동 루틴과 과정을 담아주세요. 준비운동, 본 운동, 식단 관리, 동기부여 메시지를 포함하여 건강한 라이프스타일을 보여주세요.",
        일상: "특별한 테마 없이 하루의 자연스러운 흐름을 담아주세요. 일과, 소소한 행복, 예상치 못한 순간들을 솔직하게 공유하세요.",
        데이트:
          "데이트 과정을 로맨틱하게 담아주세요. 데이트 준비, 만남, 데이트 코스, 둘만의 대화를 감성적으로 표현하세요.",
        요리: "요리 과정과 완성까지를 보여주세요. 레시피 소개, 조리 과정, 플레이팅, 시식 리액션을 자연스럽게 담아주세요.",
      };

      const specificVlogPrompt =
        vlogTypePrompts[vlogType || "일상"] || vlogTypePrompts["일상"];

      contents = `"${newKeyword}"를 주제로 한 "${
        vlogType || "일상"
      }" 타입의 완전히 새로운 브이로그를 기획해주세요. 목표 영상 길이는 약 ${length}입니다.${lengthGuideline}

**절대 규칙:**
- 아래 제공된 분석 자료의 **대본 구조(단계별 흐름)**만 참고하세요
- 원본 브이로그의 장면, 상황, 대사는 절대 사용하지 마세요
- "${newKeyword}"를 중심으로 완전히 새로운 장면과 상황을 창작하세요

**${vlogType || "일상"} 브이로그 특화 가이드:**
${specificVlogPrompt}

**공통 브이로그 요소:**
- 자연스러운 흐름과 친근한 톤앤매너
- 시청자와의 공감대 형성 (TMI, 솔직한 이야기)
- 편집 리듬: 빠른 컷 전환과 감성적인 BGM
- 시각적 미학: 자연광, 감성적인 색감, 일상의 아름다움 포착
- 썸네일: 자연스럽고 공감 가는 순간

**구성 흐름:**
1. 인트로: 오늘의 브이로그 소개
2. 메인 컨텐츠: ${vlogType || "일상"}에 맞는 자연스러운 전개
3. 하이라이트: 특별한 순간/포인트
4. TMI: 개인적인 생각과 감정 공유
5. 아웃트로: 마무리와 다음 영상 예고

각 장면마다 구체적인 촬영 가이드와 편집 포인트를 포함해주세요.

**이미지 프롬프트 작성 가이드 - 브이로그 스타일**:
기본 키워드: candid photo, vlog style, natural lighting, realistic, friendly, warm color palette

하위 타입별 추가 키워드:
- 모닝 루틴: soft morning light, cozy, peaceful, serene, waking up scene, warm tones
- 다이어트: healthy food, fitness, energetic, fresh ingredients, bright and clean
- 여행: beautiful landscape, wide angle shot, adventurous, vibrant colors, travel photography
- 언박싱: unboxing, product focused, clean background, detailed shot, excitement
- 패션: fashion style, full body shot, street style photography, stylish outfit, confident pose
- 공부: study with me, desk setup, focused, calm, lofi mood, cozy lighting
- 운동: dynamic action shot, fitness, workout, powerful, energetic, gym setting
- 일상: slice of life, candid moment, authentic, simple, everyday scene
- 데이트: romantic, lovely couple, warm sunset light, happy moment, soft focus
- 요리: home cooking, cozy kitchen, bright natural light, simple and delicious food

예시: "candid vlog style photo of a person waking up, soft morning light, cozy bedroom, peaceful and serene, warm tones, natural realistic style"

**참고용 대본 구조 (구조만 차용, 내용은 절대 사용 금지):**

${analysisString}

위 구조의 흐름만 참고하여, "${newKeyword}"를 주제로 완전히 새로운 브이로그 장면과 대사를 창작해주세요. 모든 결과 항목을 지정된 구조에 맞춰 JSON 형식으로 제공해주세요.`;
    } else if (isMukbangChannel) {
      contents = `"${newKeyword}" 음식으로 완전히 새로운 먹방 영상 기획안을 만들어 주세요. 목표 영상 길이는 약 ${length}입니다.${lengthGuideline}

**절대 규칙:**
- 아래 제공된 분석 자료의 **대본 구조(단계별 흐름)**만 참고하세요
- 원본 먹방의 장면, 대사, 리액션은 절대 사용하지 마세요
- "${newKeyword}"를 중심으로 완전히 새로운 장면과 리액션을 창작하세요

**먹방 콘텐츠 가이드:**
- 음식을 먹는 과정을 중심으로, 맛 리액션과 음식 소개를 자연스럽게 담아주세요
- ASMR 요소: 씹는 소리, 조리 소리 등 청각적 만족감
- 음식 디테일: 클로즈업 샷으로 비주얼 강조
- 조리 과정: 요리하는 경우 간단한 레시피 소개
- 솔직한 리액션: 맛, 식감, 온도 등에 대한 자연스러운 반응

**구성 요소:**
1. 인트로: 오늘의 메뉴 소개 및 기대감 조성
2. 음식 준비: 구매 과정 또는 조리 과정 (선택)
3. 첫 입 리액션: 첫 맛의 솔직한 느낌
4. 본격 먹방: 다양한 앵글과 ASMR
5. 총평: 음식에 대한 종합 평가 및 추천

각 장면마다 촬영 팁과 편집 포인트를 포함해주세요.

**이미지 프롬프트 작성 가이드 - 먹방 스타일**:
- 핵심 키워드: extreme close-up on food, delicious, mouth-watering, vibrant, dynamic eating shot
- 음식을 극단적으로 클로즈업하여 맛있어 보이는 질감과 색감 극대화
- ASMR 요소를 시각적으로 표현
- 예시: "extreme close-up of delicious Korean fried chicken, mouth-watering, vibrant colors, steam rising, highly detailed food texture, appetizing presentation"

**참고용 대본 구조 (구조만 차용, 내용은 절대 사용 금지):**

${analysisString}

위 구조의 흐름만 참고하여, "${newKeyword}"를 주제로 완전히 새로운 먹방 장면과 리액션을 창작해주세요. 모든 결과 항목을 지정된 구조에 맞춰 JSON 형식으로 제공해주세요.`;
    } else if (category === "쇼핑 리뷰") {
      contents = `"${newKeyword}" 제품에 대한 완전히 새로운 리뷰 영상 기획안을 만들어 주세요. 목표 영상 길이는 약 ${length}입니다.${lengthGuideline}

**절대 규칙:**
- 아래 제공된 분석 자료의 **대본 구조(단계별 흐름)**만 참고하세요
- 원본 리뷰의 제품 정보, 평가 내용, 대사는 절대 사용하지 마세요
- "${newKeyword}" 제품의 특성에 맞는 완전히 새로운 리뷰 내용을 창작하세요

영상은 '오프닝', '제품 소개', '주요 특징 시연', '장단점 분석', '총평 및 추천'으로 구성되어야 합니다. 이 구조에 맞춰 각 단계별 제목, 목적, 상세 내용이 포함된 구조적인 개요를 작성해주세요.

**이미지 프롬프트 작성 가이드 - 쇼핑 리뷰 스타일**:
- 핵심 키워드: product shot, studio lighting, clean background, macro shot, detailed texture
- 제품의 디테일과 질감이 잘 보이도록 스튜디오 조명과 깔끔한 배경 활용
- 접사 구도로 제품 특징 강조
- 예시: "product photography of wireless earbuds, studio lighting, white clean background, macro detailed shot, sleek design, high quality texture, 8K"

**참고용 대본 구조 (구조만 차용, 내용은 절대 사용 금지):**

${analysisString}

위 구조의 흐름만 참고하여, "${newKeyword}"를 주제로 완전히 새로운 리뷰 내용을 창작해주세요. 모든 결과 항목을 지정된 구조에 맞춰 JSON 형식으로 제공해주세요.`;
    } else if (category === "49금") {
      contents = `성인 대상의 성숙한 연애/관계 이야기("${newKeyword}")를 다루는 영상 기획안을 만들어 주세요. 목표 영상 길이는 약 ${length}입니다.${lengthGuideline}

**중요: 콘텐츠 가이드라인**
- 선정적이거나 노골적인 표현은 절대 사용하지 마세요
- 성인들의 솔직하고 현실적인 연애 고민, 관계 경험담에 초점
- 유머러스하면서도 품위 있는 스토리텔링
- 공감과 위로를 줄 수 있는 따뜻한 톤
- 교훈이나 인사이트를 담아 의미 있는 내용으로 구성

**콘텐츠 방향:**
- 연애 초기의 설렘과 고민 (썸, 호감, 첫 만남)
- 관계에서 겪는 현실적인 문제와 해결 (다툼, 오해, 화해)
- 이별과 성장 이야기 (극복, 교훈, 새로운 시작)
- 연애 심리와 패턴 분석 (MBTI, 연애 스타일)
- 건강한 관계를 위한 소통과 이해

**스토리텔링 구조:**
1. 후크: 공감 가는 상황 제시
2. 전개: 등장인물의 심리와 행동 묘사
3. 갈등: 관계에서의 현실적인 문제
4. 해결/인사이트: 배울 점이나 교훈
5. 마무리: 시청자에게 위로와 응원 메시지

**배역 구성:**
- '나', '상대방', '친구' 등 자연스러운 대화형 구성
- 각 배역의 심리와 감정선을 섬세하게 표현
- 현실적이고 공감 가는 대사와 상황 연출

**이미지 프롬프트 작성 가이드 - 49금 (연애 스토리) 스타일**:
- 핵심 키워드: intimate, sensual, moody, low-key lighting, suggestive, romantic atmosphere
- 은밀하고 감각적인 분위기를 위해 어둡고 부드러운 조명과 로맨틱한 무드 강조
- 감정과 심리 상태 중심, 선정적 요소 배제
- 예시: "intimate scene of two people talking closely, moody lighting, romantic atmosphere, soft focus, emotional connection, low-key photography, suggestive but tasteful"

모든 내용은 건전하고 교육적인 가치를 지니며, 플랫폼 가이드라인을 100% 준수해야 합니다.

성공적인 동영상 분석 내용:\n\n${analysisString}\n\n이제 위 분석된 성공 구조를 따르되 새로운 키워드 "${newKeyword}"에 초점을 맞춘 완전히 새로운 기획안을 생성해주세요. 원본 대본의 내용을 사용하지 말고, 새로운 스토리와 대사를 창작해주세요. 모든 결과 항목을 지정된 구조에 맞춰 JSON 형식으로 제공해주세요.`;
    } else if (isYadamChannel) {
      contents = `조선시대를 배경으로 한 전통 야담 이야기("${newKeyword}")를 현대적으로 재해석한 영상 기획안을 만들어 주세요. 목표 영상 길이는 약 ${length}입니다.

**중요: 야담 콘텐츠 가이드라인**
- 야담은 조선시대의 민간 설화, 기록, 일화 등을 다루는 전통 스토리텔링입니다
- 역사적 고증과 현대적 재미를 균형있게 배치
- 교훈적이거나 흥미로운 이야기를 통해 옛 선조들의 지혜 전달
- 한국 전통 문화와 정서를 자연스럽게 녹여내기

**콘텐츠 소재:**
- 조선시대 실제 인물들의 일화 (학자, 관리, 선비, 기생 등)
- 전통 설화와 민담 (도깨비, 구미호, 저승사자 등)
- 의적, 협객 이야기
- 조선시대 미스터리와 사건들
- 궁중 야사와 역사적 뒷이야기
- 양반과 평민의 삶, 사회 풍자

**스토리텔링 구조:**
1. 배경 소개: 시대적 배경과 상황 설명
2. 사건 발단: 이야기의 시작과 주요 인물 등장
3. 전개: 갈등과 사건의 전개
4. 절정: 이야기의 하이라이트
5. 결말과 교훈: 이야기의 마무리와 현대적 의미

**배역 구성:**
- 조선시대 인물들: 양반, 선비, 사또, 포졸, 상인, 기생, 무당 등
- 나레이터: 이야기를 풀어가는 전통적인 이야기꾼 톤
- 각 배역의 신분과 시대적 특성을 반영한 말투와 행동

**연출 포인트:**
- 한국 전통 음악(국악) 활용
- 한복, 전통 가옥 등 시대상 반영
- 서예, 한시 등 전통 문화 요소 삽입
- 현대인이 이해하기 쉽도록 적절한 설명 추가

각 대사마다 조선시대 분위기를 살린 이미지 생성 프롬프트('imagePrompt')를 반드시 포함해야 합니다.

**이미지 프롬프트 작성 가이드 - 야담 (조선시대) 스타일**:
- 핵심 키워드: traditional Korean painting style, folklore, mysterious night, moonlight, ancient, historical illustration
- 한국 전통 민담 느낌을 살리기 위해 전통 회화 스타일, 달빛, 고전적 요소 사용
- 한복, 한옥, 전통 소품 등을 구체적으로 묘사
- 예시: "traditional Korean painting style of a scholar in hanbok under moonlight, ancient Joseon era, mysterious atmosphere, historical illustration, folklore art style"

성공적인 동영상 분석 내용:\n\n${analysisString}\n\n이제 위 분석된 성공 구조를 따르되 새로운 키워드 "${newKeyword}"에 초점을 맞춘 완전히 새로운 조선시대 야담 이야기를 창작해주세요. 원본 대본의 내용이나 스토리를 사용하지 말고, 새로운 인물과 사건으로 구성된 독창적인 야담을 만들어주세요. 모든 결과 항목을 지정된 구조에 맞춰 JSON 형식으로 제공해주세요.`;
    } else if (isGukppongChannel) {
      contents = `한국의 우수성과 세계 속에서의 위상을 주제로 한 국뽕 콘텐츠("${newKeyword}")를 기획해 주세요. 목표 영상 길이는 약 ${length}입니다.${lengthGuideline}

**중요: 국뽕 콘텐츠 가이드라인**

국뽕 콘텐츠는 한국의 성취와 우수성을 강조하여 시청자에게 민족적 자긍심과 감정적 만족을 제공하는 콘텐츠입니다.

**핵심 테마:**
1. **국가적 우월성 강조**
   - "한국이 세계를 놀라게 했다"
   - "다른 나라들이 따라할 수 없는 한국만의 것"
   - "세계가 인정한 K-OOO"
   
2. **비교를 통한 우월성 입증**
   - "일본은 못하는데 한국은 해냈다"
   - "미국도 배우러 오는 한국의 OOO"
   - "중국이 따라하려다 실패한 한국 기술"
   
3. **외국인 반응 중심**
   - "외국인들이 충격받은 한국의 OOO"
   - "해외에서 난리난 K-OOO"
   - "외국인들이 인정한 한국 문화"

**심리적 메커니즘:**
- 집단 정체성 강화: "우리 한국인은 특별하다"는 소속감
- 확증 편향 활용: 한국의 긍정적인 면만 선별적으로 제시
- 감정적 카타르시스: 자랑스러움, 뿌듯함, 우월감 제공
- 방어 기제: 역사적 아픔이나 현재의 문제를 성취로 상쇄

**콘텐츠 구성 패턴:**
1. **충격적인 도입부**
   - "외국인들이 한국에 와서 가장 놀란 것은?"
   - "일본 전문가도 인정한 한국의 진짜 실력"
   - "세계가 한국을 보는 진짜 이유"

2. **과장된 타이틀과 썸네일**
   - "세계 1위", "충격", "경악", "난리"
   - 외국인의 놀란 표정 이미지
   - 한국 vs 타국 비교 그래픽

3. **선별적 정보 제시**
   - 한국의 성공 사례만 집중 조명
   - 통계나 순위의 유리한 부분만 발췌
   - 맥락 없는 외국인 칭찬 영상 편집

4. **감정적 음악과 연출**
   - 웅장한 배경음악
   - 애국가나 한국 전통 음악 활용
   - 태극기, 한국 랜드마크 이미지

5. **애국적 결론**
   - "한국인이라 자랑스럽다"
   - "우리가 몰랐던 한국의 진짜 위상"
   - "세계가 부러워하는 대한민국"

**주요 소재 예시:**
- K-POP, K-드라마의 세계적 성공
- 한국 IT 기술 (반도체, 스마트폰, 인터넷 속도)
- 한식의 세계화 (김치, 비빔밥, 한국 BBQ)
- 한국의 경제 성장 (한강의 기적)
- 한국 스포츠 스타들의 활약
- 한국 역사의 자랑스러운 순간들
- 외국인들이 놀라는 한국 문화 (배달 시스템, 편의점, 대중교통)
- 한국의 교육열과 성취
- K-방역, K-뷰티 등 신조어로 표현되는 한국식 시스템

**배역 구성:**
- 나레이터: 자부심 넘치는 톤으로 한국의 우수성 강조
- 외국인 반응자: 감탄하고 놀라는 리액션 표현
- 전문가: 한국의 성취를 객관적으로(?) 인증하는 역할
- 한국인 당사자: 겸손하지만 자랑스러운 태도

**타이틀 예시:**
- "일본인도 충격받은 한국의 진짜 기술력"
- "미국인들이 한국에 와서 가장 부러워한 것"
- "외국인들이 인정한 한국이 세계 최고인 이유"
- "중국이 절대 못 따라하는 한국만의 비밀"
- "세계가 한국을 보는 진짜 시선 (외국인 반응)"
- "유럽인들이 한국 문화에 열광하는 이유"
- "한국인도 몰랐던 세계 속 대한민국의 위상"

**주의사항:**
- 과도한 비하나 혐오 표현은 지양 (건전한 자부심 유지)
- 팩트 체크된 정보 기반 (과장은 OK, 거짓은 NO)
- 타국에 대한 직접적인 비난보다는 한국의 우수성 강조
- 감정적 공감대 형성에 집중

각 대사마다 한국의 우수성을 시각적으로 보여주는 이미지 생성 프롬프트('imagePrompt')를 반드시 포함해야 합니다.

**이미지 프롬프트 작성 가이드 - 국뽕 스타일**:
- 핵심 키워드: epic, grand scale, patriotic, dynamic, inspiring, vibrant national symbols
- 웅장하고 영감을 주는 분위기를 위해 역동적인 구도와 상징적 요소를 화려하게 표현
- 한국의 상징적 요소 강조 (한글, 태극기, 한복, 현대 건축물, K-pop, 한식 등)
- 예시: "epic scene of Seoul city skyline at night with Namsan Tower, grand scale, vibrant neon lights, patriotic, inspiring atmosphere, dynamic composition, highly detailed, cinematic"

**참고용 대본 구조 (구조만 차용, 내용은 절대 사용 금지):**

${analysisString}

위 구조의 흐름만 참고하여, "${newKeyword}"를 주제로 완전히 새로운 국뽕 스토리와 대사를 창작해주세요. 원본 대본의 사례나 내용은 사용하지 마세요. 모든 결과 항목을 지정된 구조에 맞춰 JSON 형식으로 제공해주세요.`;
    } else if (isNorthKoreaChannel) {
      contents = `북한 관련 이슈와 탈북민 이야기("${newKeyword}")를 다루는 영상 기획안을 만들어 주세요. 목표 영상 길이는 약 ${length}입니다.${lengthGuideline}

**절대 규칙:**
- 아래 제공된 분석 자료의 **대본 구조(단계별 흐름)**만 참고하세요
- 원본 영상의 등장인물, 상황, 배경, 대사는 절대 사용하지 마세요
- "${newKeyword}"를 중심으로 완전히 새로운 인물, 상황, 스토리를 창작하세요

**중요: 북한 이슈 콘텐츠 가이드라인**

북한 이슈 콘텐츠는 북한의 실상과 탈북민의 경험담을 진지하면서도 흥미롭게 다루는 콘텐츠입니다.

**핵심 테마:**
1. **탈북민의 생생한 증언**
   - 북한에서의 실제 생활 경험
   - 탈북 과정의 위험과 역경
   - 남한 적응기와 문화 충격
   - 북한에 두고 온 가족에 대한 그리움

2. **북한 사회의 실상**
   - 북한의 일상생활과 문화
   - 계급 제도와 사회 구조
   - 북한 주민들의 실제 생활상
   - 외부 세계에 대한 북한 주민의 인식

3. **남북 비교와 문화 차이**
   - 같은 언어, 다른 문화
   - 생활 방식의 차이
   - 가치관과 사고방식의 차이
   - 통일에 대한 현실적 고민

**스토리텔링 구조:**
1. 후크: 충격적이거나 흥미로운 북한 관련 사실
2. 배경: 탈북민의 북한 생활 소개
3. 전개: 구체적인 경험담과 에피소드
4. 절정: 가장 인상 깊거나 극적인 순간
5. 마무리: 현재의 삶과 메시지

**배역 구성:**
- '탈북민', '인터뷰어', '친구', '가족' 등
- 북한식 억양과 표현을 자연스럽게 반영
- 감정선을 섬세하게 표현

**주의사항:**
- 북한 주민에 대한 존중과 이해 유지
- 선정적이거나 자극적인 표현 지양
- 팩트 기반의 정보 전달
- 탈북민의 인권과 안전 고려
- 통일과 화해의 메시지 포함

각 대사마다 북한의 실상이나 탈북 과정을 시각적으로 표현하는 이미지 생성 프롬프트('imagePrompt')를 반드시 포함해야 합니다.

**이미지 프롬프트 작성 가이드 - 북한 이슈 스타일**:
- 핵심 키워드: documentary style, historical, somber mood, contrast between light and dark, emotional, realistic
- 다큐멘터리 같은 진지하고 사실적인 분위기
- 북한의 특징적 요소 반영 (건축물, 의상, 생활 모습 등)
- 탈북 과정의 긴장감과 감정 표현
- 예시: "documentary style photo of North Korean daily life, somber mood, historical atmosphere, realistic depiction, contrast lighting, emotional storytelling"

**참고용 대본 구조 (구조만 차용, 내용은 절대 사용 금지):**

${analysisString}

위 구조의 단계별 흐름(예: 도입→전개→절정→결말)만 참고하여, "${newKeyword}"를 주제로 완전히 새로운 북한 이슈 스토리를 창작해주세요. 모든 결과 항목을 지정된 구조에 맞춰 JSON 형식으로 제공해주세요.`;
    } else {
      contents = `"${newKeyword}" 주제에 대한 완전히 새로운 정보성 영상 기획안을 만들어 주세요. 목표 영상 길이는 약 ${length}입니다.${lengthGuideline}

**절대 규칙:**
- 아래 제공된 분석 자료의 **대본 구조(단계별 흐름)**만 참고하세요
- 원본 영상의 정보, 사례, 대사는 절대 사용하지 마세요
- "${newKeyword}"에 맞는 완전히 새로운 정보와 내용을 창작하세요

영상은 '도입(문제 제기)', '본론(핵심 정보 전달)', '결론(요약 및 제언)'의 구조를 가져야 합니다. 이 구조에 맞춰 각 단계별 제목, 목적, 상세 내용이 포함된 구조적인 개요를 작성해주세요.

**이미지 프롬프트 작성 가이드 - 카테고리별 스타일**:

카테고리에 따라 아래 키워드를 활용하세요:

- **정보 전달**: clean style, minimalist, bright lighting, infographic style, clear focus, organized
  예: "clean minimalist infographic style, bright lighting, organized layout, information visualization, clear focus, professional"

- **IT/테크**: futuristic, sleek, glowing elements, data visualization, minimalist, high-tech
  예: "futuristic tech concept, sleek design, glowing blue elements, data visualization, high-tech atmosphere, minimalist"

- **요리/쿡방**: delicious food photography, bright clean lighting, vibrant colors, fresh ingredients
  예: "delicious food photography, bright natural lighting, vibrant colors, fresh ingredients, appetizing presentation"

- **뷰티**: beauty shot, soft studio lighting, flawless skin, elegant, close-up on face
  예: "beauty shot with soft studio lighting, elegant makeup, flawless skin, close-up portrait, professional beauty photography"

- **게임**: epic, dynamic action, fantasy art, concept art, glowing magic effects, cinematic
  예: "epic fantasy game art, dynamic action scene, glowing magic effects, cinematic composition, concept art style"

- **건강**: healthy lifestyle, natural light, vibrant, energetic, clean and fresh
  예: "healthy lifestyle scene, natural light, vibrant and energetic, clean fresh atmosphere, wellness concept"

- **미스터리**: noir style, dramatic shadows, mysterious, suspenseful, foggy, low-key lighting
  예: "noir mystery style, dramatic shadows, mysterious atmosphere, suspenseful mood, foggy background, low-key lighting"

**참고용 대본 구조 (구조만 차용, 내용은 절대 사용 금지):**

${analysisString}

위 구조의 흐름만 참고하여, "${newKeyword}"를 주제로 완전히 새로운 정보와 내용을 창작해주세요. 모든 결과 항목을 지정된 구조에 맞춰 JSON 형식으로 제공해주세요.`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction:
          "당신은 창의적인 YouTube 스크립트 작가 겸 기획자입니다. 성공 공식을 바탕으로 새로운 주제에 대한 기획안을 생성합니다. 요청된 카테고리와 영상 길이에 맞춰 결과물의 형식과 분량을 조절해주세요. 모든 텍스트 설명은 가독성을 위해 **굵은 글씨**를 활용하고, 글머리 기호(-) 대신 문단 사이에 두 번의 줄바꿈을 사용하여 명확하게 구분해주세요.",
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as NewPlan;
  } catch (error: any) {
    console.error("Error generating new plan:", error);
    
    let userMessage = "[오류] 새로운 기획안 생성 중 오류가 발생했습니다.\n\n";
    
    const errorString = JSON.stringify(error);
    const errorMessage = error.message || '';
    
    if (errorString.includes('SERVICE_DISABLED') || errorString.includes('PERMISSION_DENIED') || errorMessage.includes('has not been used in project') || errorMessage.includes('is disabled')) {
      userMessage += "[원인]\n- API 키의 Generative Language API가 비활성화되어 있습니다\n\n[해결 방법]\n";
      userMessage += "1. https://aistudio.google.com/app/apikey 에서 새 API 키를 발급받으세요\n";
      userMessage += "2. 기존 API 키 사용 시, Google Cloud Console에서 'Generative Language API'를 활성화하세요\n";
      userMessage += "3. API 키를 새로 발급받은 경우, 5-10분 정도 기다린 후 다시 시도하세요";
    } else if (errorMessage.includes('API_KEY') || errorMessage.includes('invalid') || errorString.includes('INVALID_ARGUMENT')) {
      userMessage += "[원인]\n- API 키가 유효하지 않거나 만료되었습니다\n\n[해결 방법]\n- API 키를 다시 확인하고 재설정해주세요";
    } else if (errorMessage.includes('quota') || errorString.includes('RESOURCE_EXHAUSTED')) {
      userMessage += "[원인]\n- API 사용량이 초과되었습니다\n\n[해결 방법]\n- 잠시 후 다시 시도해주세요\n- Google AI Studio에서 API 사용량을 확인해주세요";
    } else if (errorMessage.includes('rate') || errorString.includes('RATE_LIMIT')) {
      userMessage += "[원인]\n- API 요청이 너무 빠르게 발생했습니다\n\n[해결 방법]\n- 10초 정도 기다린 후 다시 시도해주세요";
    } else {
      userMessage += "[가능한 원인]\n- 키워드가 너무 복잡하거나 부적절합니다\n- AI 서버 일시적 오류\n- 네트워크 연결 문제\n\n[해결 방법]\n- 더 간단한 키워드로 다시 시도해주세요\n- 잠시 후 다시 시도해주세요";
    }
    
    userMessage += `\n\n[개발자 정보]\n${errorMessage || '알 수 없는 오류'}\n${error.stack ? '\nStack: ' + error.stack : ''}`;
    
    throw new Error(userMessage);
  }
};
