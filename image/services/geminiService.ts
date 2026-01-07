import {
  GoogleGenAI,
  Type,
  Modality,
  GenerateContentResponse,
  PersonGeneration,
} from "@google/genai";
import {
  RawCharacterData,
  Character,
  AspectRatio,
  ImageStyle,
  PhotoComposition,
  CameraAngle,
  CameraAngleImage,
} from "../types";
import { replaceUnsafeWords } from "../utils/contentSafety";
import { resizeImageToAspectRatio } from "../utils/imageResize";

// 디버그 모드 설정 (개발 환경에서만 로그 출력)
const DEBUG_MODE = process.env.NODE_ENV !== "production";
const debugLog = (...args: any[]) => {
  if (DEBUG_MODE) {
    console.log(...args);
  }
};

// AspectRatio를 픽셀 크기로 변환하는 함수
const getImageDimensions = (aspectRatio: AspectRatio): { width: number; height: number } => {
  switch (aspectRatio) {
    case "16:9":
      return { width: 1920, height: 1080 };
    case "9:16":
      return { width: 1080, height: 1920 };
    case "1:1":
      return { width: 1024, height: 1024 };
    default:
      return { width: 1920, height: 1080 };
  }
};

// AspectRatio에 대한 명확한 프롬프트 지시사항 생성
const getAspectRatioPrompt = (aspectRatio: AspectRatio): string => {
  switch (aspectRatio) {
    case "16:9":
      return "CRITICAL: Generate image in 16:9 LANDSCAPE aspect ratio. Width MUST be 1.778 times the height. This is a HORIZONTAL/WIDE format image (1920x1080 pixels). NOT square, NOT portrait.";
    case "9:16":
      return "CRITICAL: Generate image in 9:16 PORTRAIT aspect ratio. Height MUST be 1.778 times the width. This is a VERTICAL/TALL format image (1080x1920 pixels). NOT square, NOT landscape.";
    case "1:1":
      return "CRITICAL: Generate image in 1:1 SQUARE aspect ratio. Width and height MUST be exactly equal (1024x1024 pixels). NOT landscape, NOT portrait.";
    default:
      return "CRITICAL: Generate image in 16:9 LANDSCAPE aspect ratio (1920x1080 pixels).";
  }
};

// API 호출 재시도 로직 (Rate Limit 및 Quota 초과 대응)
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  initialDelay: number = 10000, // 10초부터 시작
  onRetry?: (attempt: number, delay: number, error: any) => void
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message || String(error);
      const errorCode = error?.error?.code || error?.code;
      
      // Rate Limit 또는 Quota 초과 에러인 경우만 재시도
      const isRateLimitError = 
        errorMessage.includes("RATE_LIMIT") || 
        errorMessage.includes("rate limit") ||
        errorMessage.includes("QUOTA_EXCEEDED") ||
        errorMessage.includes("quota") ||
        errorMessage.includes("RESOURCE_EXHAUSTED") ||
        errorCode === 429 ||
        errorCode === 503;
      
      if (!isRateLimitError || attempt === maxRetries) {
        throw error; // 재시도하지 않을 에러이거나 마지막 시도면 throw
      }
      
      // 지수 백오프 계산 (10초, 20초, 40초, 80초, 160초)
      const delay = initialDelay * Math.pow(2, attempt - 1);
      
      console.log(`⏳ API 한도 초과 감지. ${attempt}/${maxRetries}번째 재시도 - ${delay/1000}초 후 재시도...`);
      
      if (onRetry) {
        onRetry(attempt, delay, error);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

// 에러 메시지 포맷팅 함수
const formatErrorMessage = (error: any, context: string = ""): string => {
  const errorObj = typeof error === 'string' ? { message: error } : error;
  const errorMessage = errorObj?.message || String(error);
  const errorCode = errorObj?.error?.code || errorObj?.code;
  const errorStatus = errorObj?.error?.status || errorObj?.status;

  // 한글 사용자 친화적 메시지 생성
  let userMessage = "❌ 이미지 생성 중 오류가 발생했습니다.";
  let solutions: string[] = [];

  // 에러 타입별 메시지 매핑
  if (errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("invalid API key") || errorCode === 401) {
    userMessage = "❌ API 키가 올바르지 않습니다.";
    solutions = [
      "1. Google AI Studio에서 새 API 키를 발급받아주세요.",
      "2. 화면 상단의 API 키 입력란에 올바른 키를 입력해주세요.",
      "3. API 키에 공백이나 특수문자가 잘못 포함되지 않았는지 확인해주세요."
    ];
  } else if (errorMessage.includes("QUOTA_EXCEEDED") || errorMessage.includes("quota") || errorCode === 429) {
    userMessage = "❌ API 사용량이 초과되었습니다.";
    solutions = [
      "1. Google AI Studio에서 현재 할당량을 확인해주세요.",
      "2. 할당량이 리셋될 때까지 기다리거나 새 API 키를 발급받아주세요.",
      "3. 한 번에 너무 많은 이미지를 생성하지 않도록 주의해주세요."
    ];
  } else if (errorMessage.includes("RATE_LIMIT") || errorMessage.includes("rate limit")) {
    userMessage = "❌ 요청 속도 제한에 도달했습니다.";
    solutions = [
      "1. 잠시 후(약 1분) 다시 시도해주세요.",
      "2. 이미지를 한 번에 여러 개 생성하는 대신 하나씩 생성해주세요.",
      "3. 계속 문제가 발생하면 5-10분 후에 다시 시도해주세요."
    ];
  } else if (errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("exhausted")) {
    userMessage = "❌ 서버 리소스가 일시적으로 부족합니다.";
    solutions = [
      "1. 2-3분 후에 다시 시도해주세요.",
      "2. 이미지 생성 개수를 줄여보세요.",
      "3. 문제가 계속되면 다른 시간대에 다시 시도해주세요."
    ];
  } else if (errorMessage.includes("UNAVAILABLE") || errorMessage.includes("overloaded") || errorCode === 503) {
    userMessage = "❌ AI 모델이 일시적으로 과부하 상태입니다.";
    solutions = [
      "1. 2-3분 후에 다시 시도해주세요.",
      "2. 현재 많은 사용자가 접속 중일 수 있습니다.",
      "3. 잠시 후 다시 시도하면 정상적으로 작동할 것입니다."
    ];
  } else if (errorMessage.includes("DEADLINE_EXCEEDED") || errorMessage.includes("timeout")) {
    userMessage = "❌ 요청 시간이 초과되었습니다.";
    solutions = [
      "1. 인터넷 연결 상태를 확인해주세요.",
      "2. 다시 시도해주세요.",
      "3. 문제가 계속되면 이미지 생성 옵션을 단순화해보세요."
    ];
  } else if (errorMessage.includes("BLOCKED") || errorMessage.includes("SAFETY") || errorMessage.includes("content policy")) {
    userMessage = "❌ 콘텐츠 정책으로 인해 생성이 차단되었습니다.";
    solutions = [
      "1. 입력한 내용에 부적절한 단어가 없는지 확인해주세요.",
      "2. 캐릭터 설명이나 스타일을 더 일반적인 표현으로 수정해주세요.",
      "3. 다른 스타일이나 배경을 선택해보세요."
    ];
  } else if (errorMessage.includes("Invalid JSON") || errorMessage.includes("parse")) {
    userMessage = "❌ API 응답 형식이 올바르지 않습니다.";
    solutions = [
      "1. 잠시 후 다시 시도해주세요.",
      "2. 문제가 계속되면 페이지를 새로고침해주세요.",
      "3. 같은 문제가 반복되면 다른 옵션으로 시도해보세요."
    ];
  } else if (errorMessage.includes("No image data") || errorMessage.includes("이미지 데이터")) {
    userMessage = "❌ 이미지가 생성되지 않았습니다.";
    solutions = [
      "1. 다시 시도해주세요.",
      "2. 다른 스타일이나 설정으로 시도해보세요.",
      "3. 문제가 계속되면 API 키를 재확인해주세요."
    ];
  }

  // 최종 메시지 구성
  let finalMessage = `${userMessage}\n\n💡 해결 방법:`;
  solutions.forEach(solution => {
    finalMessage += `\n${solution}`;
  });

  // 개발자 정보 추가
  const debugInfo: string[] = [];
  if (context) debugInfo.push(`Context: ${context}`);
  if (errorCode) debugInfo.push(`Error Code: ${errorCode}`);
  if (errorStatus) debugInfo.push(`Status: ${errorStatus}`);
  if (errorMessage && !errorMessage.includes("해결 방법")) {
    const cleanMessage = errorMessage.replace(/\n/g, ' ').substring(0, 200);
    debugInfo.push(`Original: ${cleanMessage}`);
  }

  if (debugInfo.length > 0) {
    finalMessage += `\n\n🔧 개발자 정보:\n${debugInfo.join(' | ')}`;
  }

  return finalMessage;
};

// 환경 변수에서 API 키를 가져오거나, 런타임에서 동적으로 설정
const getGoogleAI = (apiKey?: string) => {
  const key = apiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "❌ API 키가 설정되지 않았습니다.\n\n💡 해결 방법:\n1. Google AI Studio(aistudio.google.com)에 접속하세요.\n2. 왼쪽 메뉴에서 'API ? ??'를 클릭하세요.\n3. API 키를 복사하여 화면 상단 입력란에 붙여넣으세요."
    );
  }
  return new GoogleGenAI({ apiKey: key });
};

// Utility to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = (error) => reject(error);
  });
};

const extractJson = <T = unknown>(text: string): T => {
  const match = text.match(/```json\n([\s\S]*?)\n```/);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1]) as T;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Unknown error";
      console.error("Failed to parse JSON from markdown:", errorMsg);
      throw new Error(
        `❌ API 응답 형식이 올바르지 않습니다.\n\n💡 해결 방법:\n1. 잠시 후 다시 시도해주세요.\n2. 문제가 계속되면 페이지를 새로고침해주세요.\n\n🔧 개발자 정보: Invalid JSON format | ${errorMsg}`
      );
    }
  }
  // Fallback for raw JSON string
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Unknown error";
    console.error("Failed to parse raw JSON string:", errorMsg);
    throw new Error(
      `❌ API 응답을 해석할 수 없습니다.\n\n💡 해결 방법:\n1. 잠시 후 다시 시도해주세요.\n2. 입력한 내용을 단순화해보세요.\n3. 문제가 계속되면 페이지를 새로고침해주세요.\n\n🔧 개발자 정보: Could not parse JSON | ${errorMsg}`
    );
  }
};

// 스타일 프롬프트 생성 함수
const getStylePrompt = (style: string): string => {
  const styleMap: Record<string, string> = {
    "감성 멜로":
      "romantic and emotional atmosphere, soft warm lighting, dreamy mood, tender expressions",
    서부극:
      "western film style, classic cowboy aesthetic, desert landscape, adventurous atmosphere",
    "공포 스릴러":
      "mysterious cinematic atmosphere, dramatic lighting, intriguing suspenseful mood, artistic shadows",
    "1980년대":
      "South Korean 1980s retro style, vintage city street, traditional Korean architecture mixed with modernizing elements, people in 80s fashion, warm nostalgic tones, film grain",
    "2000년대":
      "South Korean 2000s Y2K aesthetic, early 2000s Seoul city street, flip phones, MP3 players, fashion trends of the era, vibrant but slightly muted colors, a mix of digital and analog feel",
    사이버펑크:
      "futuristic cyberpunk style, vibrant neon lights, advanced technology, modern urban environment",
    판타지:
      "fantasy adventure style, magical enchanted atmosphere, mystical fantasy setting, imaginative world",
    미니멀:
      "minimalist modern style, clean simple composition, elegant neutral tones, refined aesthetic",
    빈티지:
      "vintage classic style, timeless aesthetic, nostalgic retro mood, aged film quality",
    모던: "modern contemporary style, sleek urban aesthetic, sophisticated clean look, current trends",
    동물: "cute friendly animal characters, adorable lovable pets, charming wildlife, wholesome animal atmosphere",
    "실사 극대화":
      "ultra-realistic style, professional photographic quality, highly detailed imagery, cinematic photography",
    애니메이션:
      "animated cartoon style, vibrant cheerful colors, anime illustration aesthetic, stylized character design",
    먹방: "Food photography with a person eating deliciously, close-up, expressive eating, vibrant colors, appetizing, high-quality, professional food styling, focus on the joy of eating",
    귀여움:
      "Cute and charming illustration, soft pastel colors, lovely character design, heartwarming, adorable aesthetic",
    AI: "Artificial intelligence concept art, futuristic, glowing circuitry, abstract digital patterns, sleek and sophisticated, advanced technology theme",
    괴이함:
      "Surreal and bizarre art, uncanny atmosphere, dreamlike, abstract and distorted elements, strange and intriguing, dark fantasy",
    창의적인:
      "Creative and imaginative artwork, unique concept, innovative composition, vibrant and expressive, artistic and original",
    조선시대:
      "Vibrant and richly colored Joseon Dynasty, a scene of deep emotional connection. Traditional Hanok background. A warm and comforting atmosphere.",
  };

  return styleMap[style] || style;
};

// 구도 프롬프트 생성 함수
const getCompositionPrompt = (composition: PhotoComposition): string => {
  const compositionMap: Record<PhotoComposition, string> = {
    정면: "Front view, facing camera directly",
    측면: "Side view, profile shot",
    반측면: "Three-quarter view, slightly turned",
    위에서: "High angle shot, view from above",
    아래에서: "Low angle shot, view from below",
    전신: "Full body shot, entire person visible",
    상반신: "Upper body shot, waist up portrait",
    클로즈업: "Close-up headshot, detailed facial features",
  };

  return compositionMap[composition];
};

export const generateCharacters = async (
  script: string,
  apiKey?: string,
  imageStyle: "realistic" | "animation" = "realistic",
  aspectRatio: AspectRatio = "16:9",
  personaStyle?: ImageStyle,
  customStyle?: string,
  photoComposition?: PhotoComposition,
  customPrompt?: string,
  characterStyle?: string,
  backgroundStyle?: string,
  customCharacterStyle?: string,
  customBackgroundStyle?: string,
  personaReferenceImage?: string | null,
  onProgress?: (message: string) => void
): Promise<Character[]> => {
  try {
    const ai = getGoogleAI(apiKey);

    debugLog("🚀 Starting character generation process");

    // 동물 스타일인지 확인
    const isAnimalStyle = personaStyle === "동물";

    const analysisPrompt = isAnimalStyle
      ? `다음 한국어 대본을 매우 세밀하게 분석하여 주요 등장인물을 동물 캐릭터로 식별하세요. 

대본의 맥락과 스토리에 완벽하게 맞는 동물 캐릭터를 생성해야 합니다:
1. 대본에서 언급된 등장인물의 역할, 나이, 성격을 정확히 파악
2. 각 등장인물을 적절한 동물로 변환 (성격과 역할에 맞는 동물 선택)
3. 동물의 외모는 그들의 역할과 성격을 반영해야 함
4. 귀엽고 사랑스러운 동물 캐릭터로 설정해주세요

각 등장동물에 대해:
- name: 대본에 나온 이름 또는 역할명 + 동물 종류 (예: "김민준 강아지", "의사 고양이", "학생 토끼" 등)
- description: 대본의 맥락에 맞는 구체적인 동물 외모 묘사 (동물 종류, 털색, 크기, 표정, 특징, 귀여운 요소 포함)

결과를 JSON 배열로 반환하세요: \`[{name: string, description: string}]\`

대본: \n\n${script}`
      : `다음 한국어 대본을 매우 세밀하게 분석하여 주요 등장인물을 식별하세요. 
    
대본의 맥락과 스토리에 완벽하게 맞는 캐릭터를 생성해야 합니다:
1. 대본에서 언급된 등장인물의 역할, 나이, 성격을 정확히 파악
2. 대본의 시대적 배경, 장르, 분위기에 맞는 캐릭터 설정
3. 각 등장인물의 외모는 그들의 역할과 성격을 반영해야 함
4. 한국인의 특징을 가진 인물로 설정해주세요

각 등장인물에 대해:
- name: 대본에 나온 이름 또는 역할명 (예: "김영수", "의사", "학생" 등)
- description: 대본의 맥락에 맞는 구체적인 외모 묘사 (나이대, 복장, 표정, 체형, 헤어스타일, 한국인 특징 포함)

결과를 JSON 배열로 반환하세요: \`[{name: string, description: string}]\`

대본: \n\n${script}`;

    // 참조 이미지가 있으면 먼저 분석
    let referenceImageAnalysis = "";
    if (personaReferenceImage) {
      console.log("🖼️ Analyzing reference image with Gemini Vision...");
      onProgress?.("참조 이미지 분석 중...");
      
      try {
        const visionResponse = await retryWithBackoff(
          () =>
            ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: "이 이미지 속 인물의 외모를 매우 자세하게 분석해주세요. 얼굴형, 눈 모양, 코 형태, 입술, 피부톤, 헤어스타일, 헤어 컬러, 표정, 얼굴의 각도, 시선 방향, 의상 스타일 등 시각적 특징을 구체적으로 설명해주세요. 이 정보는 동일한 인물의 이미지를 생성하는데 사용됩니다.",
                    },
                    {
                      inlineData: {
                        mimeType: "image/jpeg",
                        data: personaReferenceImage,
                      },
                    },
                  ],
                },
              ],
            }),
          3,
          2000,
          (attempt, delay) => {
            onProgress?.(`⏳ API 한도 초과 - ${delay/1000}초 후 자동 재시도 (${attempt}/3)...\n잠시만 기다려주세요. 작업 시간이 다소 지연될 수 있습니다.`);
          }
        );
        
        referenceImageAnalysis = visionResponse.text;
        console.log("✅ Reference image analysis completed:", referenceImageAnalysis.substring(0, 200) + "...");
      } catch (error) {
        console.warn("⚠️ Failed to analyze reference image, continuing without it:", error);
      }
    }

    console.log("🔄 Calling Gemini API for character analysis...");
    onProgress?.("대본 분석 중...");
    
    const analysisResponse = await retryWithBackoff(
      () =>
        ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: analysisPrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ["name", "description"],
              },
            },
          },
        }),
      5,
      10000,
      (attempt, delay) => {
        onProgress?.(`⏳ API 한도 초과 - ${delay/1000}초 후 자동 재시도 (${attempt}/5)...\n잠시만 기다려주세요. 작업 시간이 다소 지연될 수 있습니다.`);
      }
    );

    console.log("✅ Character analysis API call completed");
    console.log("📄 Raw response:", analysisResponse.text);

    const characterData: RawCharacterData[] = JSON.parse(analysisResponse.text);
    console.log("📋 Parsed character data:", characterData);

    console.log(
      `Step 2: Generating images for ${characterData.length} characters sequentially...`
    );
    onProgress?.(`${characterData.length}개 캐릭터 이미지 생성 준비 중...`);

    // 순차적으로 이미지 생성하여 rate limit 방지
    const successfulCharacters: Character[] = [];
    const failedErrors: string[] = [];

    for (let i = 0; i < characterData.length; i++) {
      const char = characterData[i];
      console.log(
        `Processing character ${i + 1}/${characterData.length}: ${char.name}`
      );
      onProgress?.(`캐릭터 ${i + 1}/${characterData.length} 생성 중: ${char.name}`);

      try {
        // 각 요청 사이에 3-4초 지연 (rate limit 방지 강화)
        if (i > 0) {
          const delay = 3000 + Math.random() * 1000; // 3-4초 랜덤 지연
          console.log(`Waiting ${Math.round(delay / 1000)}s before next request...`);
          onProgress?.(`다음 캐릭터 생성 전 대기 중... (${Math.round(delay / 1000)}초)`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        // 프롬프트 생성
        let contextualPrompt: string;

        // 참조 이미지가 있는지 확인
        const hasPersonaReference =
          personaReferenceImage !== null && personaReferenceImage !== undefined && referenceImageAnalysis;
        const referenceStyleNote = hasPersonaReference
          ? `IMPORTANT: Use this reference face description to generate the character image. The character MUST have these specific facial features and appearance: ${referenceImageAnalysis}\n\n`
          : "";

        if (customPrompt && customPrompt.trim()) {
          // 커스텀 프롬프트가 있는 경우 사용 (참조 이미지 분석 추가)
          contextualPrompt = referenceStyleNote + customPrompt;
        } else {
          // 인물 스타일 결정
          const finalCharacterStyle =
            characterStyle === "custom" && customCharacterStyle
              ? customCharacterStyle
              : characterStyle || "실사 극대화";

          // 배경 스타일 결정
          const finalBackgroundStyle =
            backgroundStyle === "custom" && customBackgroundStyle
              ? customBackgroundStyle
              : backgroundStyle || "모던";

          // 구도 정보 생성
          const compositionText = getCompositionPrompt(
            photoComposition || "정면"
          );

          // 배경 스타일 프롬프트 생성
          const backgroundPrompt = getStylePrompt(finalBackgroundStyle);

          // 인물 스타일에 따른 프롬프트 생성
          if (finalCharacterStyle === "동물") {
            contextualPrompt = `반드시 ${aspectRatio} 비율로 생성. ${referenceStyleNote}${compositionText}${char.name}의 귀엽고 사랑스러운 동물 캐릭터 초상화. ${char.description}. 
                    ${backgroundPrompt} 카와이 동물 캐릭터 디자인, 매우 귀엽고 사랑스러운, 큰 표현력 있는 눈, 부드러운 털 질감, 
                    표정에서 보이는 매력적인 성격, 어린이 친화적이고 따뜻한 스타일. 
                    전문 디지털 아트, 생동감 있는 색상, 세밀한 털 패턴, 사랑스러운 특징. 
                    이미지에 동물 캐릭터 한 마리만, 자막 없음, 말풍선 없음, 텍스트 없음, 대화 없음.`;
          } else if (finalCharacterStyle === "애니메이션") {
            contextualPrompt = `반드시 ${aspectRatio} 비율로 생성. ${referenceStyleNote}${compositionText}${char.name}의 애니메이션 스타일 캐릭터 초상화. ${char.description}. 
                    ${backgroundPrompt} 한국 애니메 캐릭터 디자인, 깨끗한 애니메 아트 스타일, 다채롭고 생동감 있는, 
                    세밀한 애니메 얼굴 특징, 대본에 설명된 캐릭터의 역할과 성격에 적합. 
                    스튜디오급 애니메이션 일러스트, 전문 애니메이션 캐릭터 디자인. 
                    이미지에 한 명만, 자막 없음, 말풍선 없음, 텍스트 없음, 대화 없음.`;
          } else if (finalCharacterStyle === "웹툰") {
            contextualPrompt = `반드시 ${aspectRatio} 비율로 생성. ${referenceStyleNote}${compositionText}${char.name}의 한국 웹툰 스타일 캐릭터 초상화. ${char.description}. 
                    ${backgroundPrompt} Korean webtoon art style, clean lines, subtle shading, expressive faces, bold color palette. 
                    깨끗하고 날카로운 선화, 세밀한 음영 처리, 표정이 풍부한 얼굴, 선명한 색상. 
                    전문 웹툰 일러스트, 캐릭터의 개성과 감정이 잘 드러나는 디자인. 
                    이미지에 한 명만, 자막 없음, 말풍선 없음, 텍스트 없음, 대화 없음.`;
          } else if (finalCharacterStyle === "1980년대") {
            contextualPrompt = `반드시 ${aspectRatio} 비율로 생성. ${referenceStyleNote}${compositionText}1980년대 스타일의 ${char.name} 전문 초상화. ${char.description}. 
                    ${backgroundPrompt} 1980년대 레트로 패션, 빈티지 80년대 헤어스타일, 레트로 미학, 시대에 맞는 의상과 액세서리. 
                    고품질 초상화, 자연스러운 조명, 사실적인 스타일, 세밀한 얼굴 특징. 
                    이미지에 한 명만, 자막 없음, 말풍선 없음, 텍스트 없음, 대화 없음.`;
          } else if (finalCharacterStyle === "2000년대") {
            contextualPrompt = `반드시 ${aspectRatio} 비율로 생성. ${referenceStyleNote}${compositionText}2000년대 Y2K 스타일의 ${char.name} 전문 초상화. ${char.description}. 
                    ${backgroundPrompt} 2000년대 초반 패션 트렌드, Y2K 미학, 밀레니엄 시대 스타일, 시대에 맞는 의상. 
                    고품질 초상화, 자연스러운 조명, 사실적인 스타일, 세밀한 얼굴 특징. 
                    이미지에 한 명만, 자막 없음, 말풍선 없음, 텍스트 없음, 대화 없음.`;
          } else {
            // 실사 극대화 또는 커스텀
            const characterStylePrompt =
              finalCharacterStyle === "실사 극대화"
                ? "ultra-realistic, photographic quality, highly detailed, professional photography"
                : finalCharacterStyle;

            contextualPrompt = `반드시 ${aspectRatio} 비율로 생성. ${referenceStyleNote}${compositionText}${char.name}의 전문 초상 사진. ${char.description}. 
                    ${backgroundPrompt} ${characterStylePrompt} 고품질 한국인 헤드샷, 자연스러운 조명, 
                    세밀한 얼굴 특징, 대본에 설명된 캐릭터의 역할과 성격에 적합. 
                    사실적인 한국인 얼굴 특징에 집중, 전문 사진 품질. 
                    이미지에 한 명만, 자막 없음, 말풍선 없음, 텍스트 없음, 대화 없음.`;
          }
        }

        // Aspect ratio를 픽셀 크기로 변환 (더 명확한 크기 지정)
        let imageSizeInstruction = "";
        let ratioInstruction = "";
        switch (aspectRatio) {
          case "16:9":
            imageSizeInstruction = "EXACT SIZE: 1920 pixels wide × 1080 pixels tall";
            ratioInstruction = "CRITICAL REQUIREMENT: The image MUST be in 16:9 landscape aspect ratio (horizontal/wide format). Width must be 1.777 times the height. This is a STRICT requirement that cannot be violated.";
            break;
          case "9:16":
            imageSizeInstruction = "EXACT SIZE: 1080 pixels wide × 1920 pixels tall";
            ratioInstruction = "CRITICAL REQUIREMENT: The image MUST be in 9:16 portrait aspect ratio (vertical/tall format). Height must be 1.777 times the width. This is a STRICT requirement that cannot be violated.";
            break;
          case "1:1":
            imageSizeInstruction = "EXACT SIZE: 1080 pixels wide × 1080 pixels tall";
            ratioInstruction = "CRITICAL REQUIREMENT: The image MUST be in 1:1 square aspect ratio. Width and height must be exactly equal. This is a STRICT requirement that cannot be violated.";
            break;
        }

        // Gemini Vision API를 사용하여 이미지 생성 (영상소스와 동일한 방식)
        const parts: any[] = [];

        // 참조 이미지가 있는 경우 추가 (영상소스와 동일)
        if (personaReferenceImage) {
          parts.push({
            inlineData: {
              data: personaReferenceImage,
              mimeType: "image/jpeg",
            },
          });
          parts.push({
            text: "Reference style image - maintain visual consistency with this person's facial features, style, and appearance",
          });
        }

        // 이미지 생성 프롬프트에 크기 명시 추가
        const aspectRatioPrompt = getAspectRatioPrompt(aspectRatio);
        const finalContextualPrompt = `${aspectRatioPrompt}\n\n${ratioInstruction}\n\n${imageSizeInstruction}\n\n${contextualPrompt}`;
        parts.push({ text: finalContextualPrompt });

        let imageResponse;
        let finalPrompt = contextualPrompt;
        let contentPolicyRetry = false;
        let replacementInfo: Array<{ original: string; replacement: string }> =
          [];

        try {
          // 이미지 생성 설정 - aspectRatio 문자열 직접 전달
          const imageConfig: any = {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
            aspectRatio: aspectRatio,  // "16:9", "9:16", "1:1" 문자열 그대로
          };
          
          // 모든 경우에 generateContent 사용
          imageResponse = await retryWithBackoff(
            () =>
              ai.models.generateContent({
                model: "gemini-2.5-flash-image-preview",
                contents: { parts },
                config: imageConfig,
              }),
            5,
            10000,
            (attempt, delay) => {
              onProgress?.(`⏳ API 한도 초과 - ${char.name} 이미지 생성 대기 중...\n${delay/1000}초 후 자동 재시도 (${attempt}/5)\n잠시만 기다려주세요. 작업 시간이 다소 지연될 수 있습니다.`);
            }
          );
        } catch (firstError: any) {
          // 콘텐츠 정책 위반 감지
          const errorMessage = firstError?.message || String(firstError);
          const isSafetyError =
            errorMessage.includes("SAFETY") ||
            errorMessage.includes("BLOCK") ||
            errorMessage.includes("content policy") ||
            errorMessage.includes("harmful content") ||
            errorMessage.includes("콘텐츠 정책");

          if (isSafetyError) {
            console.warn(
              `⚠️ Content policy violation detected for ${char.name}, attempting with safe words...`
            );
            contentPolicyRetry = true;

            // 2단계: 안전한 단어로 교체하여 재시도
            const originalDescription = char.description;
            const { replacedText, replacements } =
              replaceUnsafeWords(originalDescription);
            replacementInfo = replacements;

            if (replacements.length > 0) {
              console.log(
                `🔄 Replacing words: ${replacements
                  .map((r) => `"${r.original}" → "${r.replacement}"`)
                  .join(", ")}`
              );

              // 교체된 설명으로 새 프롬프트 생성
              let safePrompt = contextualPrompt.replace(
                char.description,
                replacedText
              );

              // 프롬프트 전체에서도 위험 단어 교체
              const { replacedText: fullyReplacedPrompt } =
                replaceUnsafeWords(safePrompt);
              finalPrompt = fullyReplacedPrompt;

              await new Promise((resolve) => setTimeout(resolve, 2000)); // 2초 지연

              // 안전한 프롬프트로 parts 재구성 (영상소스와 동일)
              const safeParts: any[] = [];
              
              if (personaReferenceImage) {
                safeParts.push({
                  inlineData: {
                    data: personaReferenceImage,
                    mimeType: "image/jpeg",
                  },
                });
                safeParts.push({
                  text: "Reference style image - maintain visual consistency",
                });
              }
              
              safeParts.push({ text: finalPrompt });

              // 비율 설정 적용
              const safeImageConfig: any = {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
                aspectRatio: aspectRatio,
                personGeneration: PersonGeneration.ALLOW_ADULT,  // 성인 사람 생성 허용
              };

              imageResponse = await retryWithBackoff(
                () =>
                  ai.models.generateContent({
                    model: "gemini-2.5-flash-image-preview",
                    contents: { parts: safeParts },
                    config: safeImageConfig,
                  }),
                5,
                10000,
                (attempt, delay) => {
                  onProgress?.(`⏳ 콘텐츠 필터 우회 재시도 중 - ${char.name}\n${delay/1000}초 후 자동 재시도 (${attempt}/5)\n잠시만 기다려주세요.`);
                }
              );
            } else {
              throw firstError; // 교체할 단어가 없으면 원래 에러 발생
            }
          } else {
            throw firstError; // 콘텐츠 정책 외 에러는 그대로 발생
          }
        }

        // generateContent 응답 구조로 통일
        const imagePart = imageResponse?.candidates?.[0]?.content?.parts?.find(
          (part: any) => part.inlineData?.mimeType?.startsWith("image/")
        );
        const imageBytes = imagePart?.inlineData?.data;

        if (!imageBytes) {
          console.warn(
            `Image generation failed for character: ${char.name}, using fallback`
          );
          // 실패한 경우 더 간단한 프롬프트로 재시도
          // 비율 강조 추가
          const ratioInstruction = aspectRatio === "16:9" 
            ? "MUST BE 16:9 landscape ratio (1920x1080). "
            : aspectRatio === "9:16"
            ? "MUST BE 9:16 vertical ratio (1080x1920). "
            : "MUST BE 1:1 square ratio (1080x1080). ";
          
          const fallbackPrompt =
            personaStyle === "동물"
              ? `${ratioInstruction}${char.name}을 나타내는 귀여운 동물 캐릭터 한 마리. 심플하고 사랑스러운 동물 디자인, 깨끗한 배경, 카와이 스타일, 자막 없음, 말풍선 없음, 텍스트 없음.`
              : imageStyle === "animation"
              ? `${ratioInstruction}${char.name}을 나타내는 한국인 한 명의 심플한 애니메이션 캐릭터. 깨끗한 애니메이션 스타일, 중립적인 배경, 자막 없음, 말풍선 없음, 텍스트 없음.`
              : `${ratioInstruction}${char.name}을 나타내는 한국인 한 명의 전문 헤드샷. 깨끗한 배경, 중립적인 표정, 사실적인 스타일, 자막 없음, 말풍선 없음, 텍스트 없음.`;

          await new Promise((resolve) => setTimeout(resolve, 2000));

          const fallbackParts: any[] = [];
          if (personaReferenceImage) {
            fallbackParts.push({
              inlineData: {
                data: personaReferenceImage,
                mimeType: "image/jpeg",
              },
            });
            fallbackParts.push({ text: "Reference style image" });
          }
          fallbackParts.push({ text: fallbackPrompt });

          // 비율 설정 적용
          const fallbackImageConfig: any = {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
            aspectRatio: aspectRatio,
            personGeneration: PersonGeneration.ALLOW_ADULT,  // 성인 사람 생성 허용
          };

          const fallbackResponse = await retryWithBackoff(
            () =>
              ai.models.generateContent({
                model: "gemini-2.5-flash-image-preview",
                contents: { parts: fallbackParts },
                config: fallbackImageConfig,
              }),
            2,
            2000
          );

          const fallbackPart = fallbackResponse?.candidates?.[0]?.content?.parts?.find(
            (part: any) => part.inlineData?.mimeType?.startsWith("image/")
          );
          const fallbackBytes = fallbackPart?.inlineData?.data;
          
          if (!fallbackBytes) {
            throw new Error(formatErrorMessage(
              { message: "No image data returned from both primary and fallback attempts" },
              `Character generation: ${char.name}`
            ));
          }

          // 이미지 비율 조정
          const resizedImage = await resizeImageToAspectRatio(fallbackBytes, aspectRatio);

          successfulCharacters.push({
            id: self.crypto.randomUUID(),
            name: char.name,
            description: char.description,
            image: resizedImage,
          });
        } else {
          // 이미지 비율 조정
          const resizedImage = await resizeImageToAspectRatio(imageBytes, aspectRatio);
          
          const character: Character = {
            id: self.crypto.randomUUID(),
            name: char.name,
            description: char.description,
            image: resizedImage,
          };

          // 콘텐츠 정책 재시도로 생성된 경우 설명에 알림 추가
          if (contentPolicyRetry && replacementInfo.length > 0) {
            const replacementText = replacementInfo
              .map((r) => `"${r.original}"을(를) "${r.replacement}"(으)로`)
              .join(", ");
            character.description = `${char.description}\n\n⚠️ 알림: 콘텐츠 정책 준수를 위해 ${replacementText} 교체하여 생성되었습니다.`;
            console.log(
              `✅ Successfully generated with word replacement for ${char.name}`
            );
          }

          successfulCharacters.push(character);
        }

        console.log(`Successfully generated image for ${char.name}`);
      } catch (error) {
        console.error(`Error generating image for ${char.name}:`, error);
        
        // 에러 원인 분석
        let errorDetail = "Unknown error";
        if (error instanceof Error) {
          const msg = error.message.toLowerCase();
          if (msg.includes("safety") || msg.includes("block") || msg.includes("policy")) {
            errorDetail = "콘텐츠 정책 위반 (설명에 부적절한 단어 포함)";
          } else if (msg.includes("quota") || msg.includes("limit")) {
            errorDetail = "API 사용량 초과";
          } else if (msg.includes("network") || msg.includes("fetch")) {
            errorDetail = "네트워크 연결 오류";
          } else if (msg.includes("timeout")) {
            errorDetail = "요청 시간 초과";
          } else {
            errorDetail = error.message;
          }
        }
        
        failedErrors.push(`${char.name}: ${errorDetail}`);
      }
    }

    if (failedErrors.length > 0) {
      console.warn("Some characters failed to generate:", failedErrors);
      if (successfulCharacters.length === 0) {
        // 실패 원인별로 분류
        const policyErrors = failedErrors.filter(e => e.includes("정책"));
        const quotaErrors = failedErrors.filter(e => e.includes("사용량"));
        const networkErrors = failedErrors.filter(e => e.includes("네트워크"));
        
        let errorMessage = "❌ 모든 캐릭터 생성이 실패했습니다.\n\n";
        
        if (policyErrors.length > 0) {
          errorMessage += "📋 콘텐츠 정책 위반 캐릭터:\n";
          errorMessage += policyErrors.map(e => `  • ${e}`).join("\n");
          errorMessage += "\n\n💡 해결 방법:\n";
          errorMessage += "  1. 캐릭터 설명에서 폭력적, 선정적 표현 제거\n";
          errorMessage += "  2. 중립적이고 긍정적인 표현으로 변경\n";
          errorMessage += "  3. 구체적인 신체 묘사 대신 성격이나 역할 중심으로 작성\n\n";
        }
        
        if (quotaErrors.length > 0) {
          errorMessage += "📊 API 사용량 초과 캐릭터:\n";
          errorMessage += quotaErrors.map(e => `  • ${e}`).join("\n");
          errorMessage += "\n\n💡 해결 방법:\n";
          errorMessage += "  1. 5-10분 후 다시 시도\n";
          errorMessage += "  2. 캐릭터 수를 1-3개로 줄여서 시도\n";
          errorMessage += "  3. Google Cloud Console에서 할당량 확인\n\n";
        }
        
        if (networkErrors.length > 0) {
          errorMessage += "🌐 네트워크 오류 캐릭터:\n";
          errorMessage += networkErrors.map(e => `  • ${e}`).join("\n");
          errorMessage += "\n\n💡 해결 방법:\n";
          errorMessage += "  1. 인터넷 연결 상태 확인\n";
          errorMessage += "  2. 방화벽/보안 프로그램 확인\n";
          errorMessage += "  3. 다른 네트워크로 변경 후 재시도\n\n";
        }
        
        const otherErrors = failedErrors.filter(
          e => !e.includes("정책") && !e.includes("사용량") && !e.includes("네트워크")
        );
        if (otherErrors.length > 0) {
          errorMessage += "⚠️ 기타 오류:\n";
          errorMessage += otherErrors.map(e => `  • ${e}`).join("\n");
          errorMessage += "\n";
        }
        
        throw new Error(errorMessage);
      } else {
        // 일부만 성공한 경우 경고 메시지 추가
        console.warn(
          `⚠️ ${successfulCharacters.length}/${characterData.length} characters generated successfully. Failed: ${failedErrors.length}`
        );
      }
    }

    console.log("✅ Character generation completed successfully!");
    console.log(`📊 Generated ${successfulCharacters.length} characters`);
    return successfulCharacters;
  } catch (error) {
    console.error("❌ Character generation failed:", error);

    // 더 구체적인 에러 메시지 제공
    if (error instanceof Error) {
      const errorMsg = error.message;
      
      // 이미 한글 에러 메시지인 경우 그대로 전달
      if (errorMsg.includes("❌") || errorMsg.includes("해결 방법")) {
        throw error;
      }
      
      // 콘텐츠 정책 위반 에러를 가장 먼저 체크 (구체적인 안내)
      if (
        errorMsg.toLowerCase().includes("safety") ||
        errorMsg.toLowerCase().includes("block") ||
        errorMsg.toLowerCase().includes("policy") ||
        errorMsg.toLowerCase().includes("harmful")
      ) {
        throw new Error(
          "❌ 콘텐츠 정책 위반으로 이미지 생성이 차단되었습니다.\n\n" +
          "🔍 원인:\n입력하신 캐릭터 설명에 AI가 부적절하다고 판단한 표현이 포함되어 있습니다.\n\n" +
          "💡 해결 방법:\n" +
          "1. 폭력적, 선정적, 위험한 내용을 제거해주세요\n" +
          "2. 긍정적이고 중립적인 표현으로 변경해주세요\n" +
          "3. 구체적인 신체 묘사보다는 성격이나 역할 중심으로 작성해주세요\n" +
          "4. '밝은', '친근한', '전문적인' 등의 표현을 사용해보세요\n\n" +
          `📝 원본 오류 메시지: ${errorMsg}`
        );
      }
      
      if (
        errorMsg.includes("API_KEY_INVALID") ||
        errorMsg.includes("Invalid API key")
      ) {
        throw new Error(
          "❌ 올바르지 않은 API 키입니다.\n\n💡 해결 방법:\n1. Google AI Studio(aistudio.google.com)에서 새로운 API 키를 생성해주세요.\n2. API 키를 정확히 복사했는지 확인해주세요."
        );
      } else if (
        errorMsg.includes("billed users") ||
        errorMsg.includes("INVALID_ARGUMENT") ||
        errorMsg.includes("Imagen API is only accessible")
      ) {
        throw new Error(
          "❌ 이미지 생성 API는 결제 정보를 등록한 계정만 사용 가능합니다.\n\n💡 해결 방법:\n1. Google Cloud Console(console.cloud.google.com)에 접속\n2. 결제 정보 등록 (카드 등록, 무료 한도 내에서는 과금 안됨)\n3. Imagen API 활성화\n4. 새 API 키 발급 후 입력\n\n💡 참고: 무료 tier에서도 결제 정보만 등록하면 사용 가능합니다."
        );
      } else if (
        errorMsg.includes("PERMISSION_DENIED") ||
        errorMsg.includes("permission")
      ) {
        throw new Error(
          "❌ API 키 권한이 없습니다.\n\n💡 해결 방법:\n1. Google AI Studio에서 Imagen API를 활성화해주세요.\n2. 새로운 API 키를 발급받아주세요."
        );
      } else if (
        errorMsg.includes("QUOTA_EXCEEDED") ||
        errorMsg.includes("quota")
      ) {
        throw new Error(
          "❌ API 사용량 한도가 초과되었습니다.\n\n💡 해결 방법:\n1. 5-10분 후 다시 시도해주세요.\n2. Google Cloud Console에서 할당량을 확인해주세요.\n3. 필요시 요금제를 업그레이드해주세요."
        );
      } else if (
        errorMsg.includes("RATE_LIMIT_EXCEEDED") ||
        errorMsg.includes("RATE_LIMIT") ||
        errorMsg.includes("rate limit") ||
        errorMsg.includes("429")
      ) {
        throw new Error(
          "❌ 너무 많은 요청을 보냈습니다.\n\n💡 해결 방법:\n1. 5분 정도 기다린 후 다시 시도해주세요.\n2. 캐릭터 수를 줄여서 시도해보세요.\n3. 한 번에 하나씩 생성해보세요."
        );
      } else if (
        errorMsg.includes("RESOURCE_EXHAUSTED") ||
        errorMsg.includes("UNAVAILABLE") ||
        errorMsg.includes("overloaded") ||
        errorMsg.includes("503")
      ) {
        throw new Error(formatErrorMessage(error, "Character generation - 503 error"));
      }
    }

    // 모든 다른 에러는 포맷팅 함수로 처리
    throw new Error(formatErrorMessage(error, "Character generation"));
  }
};

export const regenerateCharacterImage = async (
  description: string,
  name: string,
  apiKey?: string,
  imageStyle: "realistic" | "animation" = "realistic",
  aspectRatio: AspectRatio = "16:9",
  personaStyle?: string
): Promise<string> => {
  const ai = getGoogleAI(apiKey);
  console.log(`Regenerating image for ${name}...`);

  try {
    // 스타일에 따른 프롬프트 생성
    let imagePrompt: string;

    if (personaStyle === "동물") {
      imagePrompt = `반드시 ${aspectRatio} 비율로 생성. ${name}의 귀엽고 사랑스러운 동물 캐릭터 일러스트. ${description}. 
            카와이 동물 캐릭터 디자인, 매우 귀엽고 사랑스러운, 큰 표현력 있는 눈, 부드러운 털 질감, 
            표정에서 보이는 매력적인 성격, 어린이 친화적이고 따뜻한 스타일. 
            전문 디지털 아트, 생동감 있는 색상, 세밀한 털 패턴, 사랑스러운 특징. 
            이미지에 동물 캐릭터 한 마리만, 자막 없음, 말풍선 없음, 텍스트 없음, 대화 없음.`;
    } else if (imageStyle === "animation") {
      imagePrompt = `반드시 ${aspectRatio} 비율로 생성. ${name}의 고품질 애니메이션 스타일 캐릭터 일러스트. ${description}. 
            한국 애니메 캐릭터 디자인, 깨끗한 애니메 아트 스타일, 다채롭고 생동감 있는, 
            세밀한 애니메 얼굴 특징. 스튜디오급 애니메이션 일러스트. 
            이미지에 한 명만, 자막 없음, 말풍선 없음, 텍스트 없음, 대화 없음.`;
    } else {
      imagePrompt = `반드시 ${aspectRatio} 비율로 생성. ${name}의 전문 초상 사진. ${description}. 
            고품질 한국인 헤드샷, 자연스러운 조명, 중립적인 배경, 사실적인 스타일, 
            세밀한 얼굴 특징. 전문 사진 품질. 
            이미지에 한 명만, 자막 없음, 말풍선 없음, 텍스트 없음, 대화 없음.`;
    }

    // Gemini Vision API 사용 (영상소스와 동일)
    const parts = [{ text: imagePrompt }];
    
    // 비율 설정 적용
    const imageConfig: any = {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
      aspectRatio: aspectRatio,
      personGeneration: PersonGeneration.ALLOW_ADULT,  // 성인 사람 생성 허용
    };

    const imageResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: { parts },
      config: imageConfig,
    });

    const imagePart = imageResponse?.candidates?.[0]?.content?.parts?.find(
      (part: any) => part.inlineData?.mimeType?.startsWith("image/")
    );
    const imageBytes = imagePart?.inlineData?.data;
    
    if (!imageBytes) {
      // 실패한 경우 더 간단한 프롬프트로 재시도
      console.warn(
        `Initial regeneration failed for ${name}, trying with simpler prompt...`
      );

      const fallbackPrompt =
        personaStyle === "동물"
          ? `반드시 ${aspectRatio} 비율로 생성. 귀여운 동물 캐릭터 한 마리. 심플하고 사랑스러운 디자인, 깨끗한 배경, 카와이 스타일, 자막 없음, 말풍선 없음, 텍스트 없음.`
          : `반드시 ${aspectRatio} 비율로 생성. 친근한 사람 한 명의 심플한 전문 초상화. 깨끗한 스타일, 중립적인 배경, 자막 없음, 말풍선 없음, 텍스트 없음.`;

      const fallbackParts = [{ text: fallbackPrompt }];
      
      // 비율 설정 적용
      const fallbackImageConfig: any = {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
        aspectRatio: aspectRatio,
        personGeneration: PersonGeneration.ALLOW_ADULT,  // 성인 사람 생성 허용
      };

      const fallbackResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: { parts: fallbackParts },
        config: fallbackImageConfig,
      });

      const fallbackPart = fallbackResponse?.candidates?.[0]?.content?.parts?.find(
        (part: any) => part.inlineData?.mimeType?.startsWith("image/")
      );
      const fallbackBytes = fallbackPart?.inlineData?.data;
      if (!fallbackBytes) {
        throw new Error(formatErrorMessage(
          { message: "No image data returned from both primary and fallback attempts" },
          `Regenerate character: ${name}`
        ));
      }

      // 이미지 비율 조정
      const resizedFallback = await resizeImageToAspectRatio(fallbackBytes, aspectRatio);
      return resizedFallback;
    }

    // 이미지 비율 조정
    const resizedImage = await resizeImageToAspectRatio(imageBytes, aspectRatio);
    return resizedImage;
  } catch (error) {
    console.error(`Error regenerating image for ${name}:`, error);
    throw new Error(formatErrorMessage(error, `Regenerate character image: ${name}`));
  }
};

// 시퀀스별 내용인지 확인하는 함수
const isSequenceFormat = (script: string): boolean => {
  const lines = script
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  let sequenceCount = 0;

  for (const line of lines) {
    // 숫자로 시작하는 패턴 (1. 2. 3. 등) 또는 번호 패턴 체크
    if (/^\d+[\.\)]\s/.test(line) || /^\d+\s*[-:]\s/.test(line)) {
      sequenceCount++;
    }
  }

  // 전체 줄의 50% 이상이 번호 패턴을 가지면 시퀀스 형식으로 판단
  return sequenceCount >= lines.length * 0.5 && sequenceCount >= 2;
};

// 시퀀스에서 장면 설명 추출하는 함수
const extractSequenceDescriptions = (script: string): string[] => {
  const lines = script
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const scenes: string[] = [];

  for (const line of lines) {
    // 번호 패턴 제거하고 순수 장면 설명만 추출
    const cleanLine = line
      .replace(/^\d+[\.\)]\s*/, "")
      .replace(/^\d+\s*[-:]\s*/, "")
      .trim();
    if (cleanLine.length > 0) {
      scenes.push(cleanLine);
    }
  }

  return scenes;
};

export const generateStoryboard = async (
  script: string,
  characters: Character[],
  imageCount: number,
  apiKey?: string,
  imageStyle: "realistic" | "animation" = "realistic",
  subtitleEnabled: boolean = true,
  referenceImage?: string | null,
  aspectRatio: AspectRatio = "16:9",
  onProgress?: (message: string) => void
): Promise<{ id: string; image: string; sceneDescription: string }[]> => {
  const ai = getGoogleAI(apiKey);

  let sceneDescriptions: string[];

  // 시퀀스 형식인지 확인
  if (isSequenceFormat(script)) {
    console.log("Step 1: Processing sequence-based input...");
    sceneDescriptions = extractSequenceDescriptions(script);
    console.log(
      `Found ${sceneDescriptions.length} sequence descriptions:`,
      sceneDescriptions
    );

    // 요청된 이미지 수만큼 조정
    if (sceneDescriptions.length > imageCount) {
      sceneDescriptions = sceneDescriptions.slice(0, imageCount);
    } else if (sceneDescriptions.length < imageCount) {
      // 시퀀스가 적으면 그 수만큼만 생성
      console.log(
        `Adjusting image count from ${imageCount} to ${sceneDescriptions.length} based on sequences`
      );
    }
  } else {
    console.log("Step 1: Generating scene descriptions from script...");
    onProgress?.("대본 분석 중...");
    const scenesPrompt = `다음 한국어 대본을 분석하세요. ${imageCount}개의 주요 시각적 장면으로 나누세요. 각 장면에 대해 이미지 생성 프롬프트로 사용할 수 있는 짧고 설명적인 캡션을 한국어로 제공하세요. 결과를 문자열의 JSON 배열로 반환하세요: \`["장면 1 설명", "장면 2 설명", ...]\`. 대본: \n\n${script}`;

    const scenesResponse = await retryWithBackoff(
      () =>
        ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: scenesPrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
        }),
      3,
      2000
    );

    sceneDescriptions = JSON.parse(scenesResponse.text);
  }

  console.log(
    `Step 2: Generating ${sceneDescriptions.length} storyboard images sequentially...`
  );
  onProgress?.(`${sceneDescriptions.length}개 영상 이미지 생성 준비 중...`);

  const storyboardResults: any[] = [];

  for (let i = 0; i < sceneDescriptions.length; i++) {
    const scene = sceneDescriptions[i];
    console.log(
      `Processing scene ${i + 1}/${sceneDescriptions.length}: ${scene.substring(
        0,
        50
      )}...`
    );
    onProgress?.(`영상 이미지 ${i + 1}/${sceneDescriptions.length} 생성 중`);

    try {
      // 각 요청 사이에 3-4초 지연 (영상 소스는 더 복잡하므로)
      if (i > 0) {
        const delay = 3000 + Math.random() * 1000; // 3-4초 랜덤 지연
        console.log(`Waiting ${Math.round(delay / 1000)}s before next scene generation...`);
        onProgress?.(`다음 이미지 생성 전 대기 중... (${Math.round(delay / 1000)}초)`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const parts: any[] = [];

      // 참조 이미지가 있는 경우 추가
      if (referenceImage) {
        parts.push({
          inlineData: {
            data: referenceImage,
            mimeType: "image/jpeg",
          },
        });
        parts.push({
          text: "Style reference image - please maintain consistency with this visual style",
        });
      }

      // 캐릭터 참조 이미지 추가 (있는 경우에만)
      characters.forEach((char) => {
        parts.push({
          inlineData: {
            data: char.image,
            mimeType: "image/jpeg",
          },
        });
        parts.push({ text: `Reference image for character: ${char.name}` });
      });

      // 스타일에 따른 이미지 생성 프롬프트
      let imageGenPrompt: string;
      const subtitleText = subtitleEnabled
        ? "한국어 자막을 포함하여"
        : "자막 없이";
      const hasCharacters = characters.length > 0;
      const hasReference =
        referenceImage !== null && referenceImage !== undefined;

      // 프롬프트 시작 부분 (캐릭터 유무에 따라 다름)
      let promptStart = "";
      if (hasCharacters && hasReference) {
        promptStart =
          "제공된 참조 캐릭터 이미지와 스타일 참조 이미지를 사용하여";
      } else if (hasCharacters) {
        promptStart = "제공된 참조 캐릭터 이미지를 사용하여";
      } else if (hasReference) {
        promptStart = "제공된 스타일 참조 이미지의 시각적 일관성을 유지하면서";
      } else {
        promptStart = ""; // 둘 다 없는 경우 (이론상 발생하지 않아야 함)
      }

      // 캐릭터 일관성 안내 (캐릭터가 있을 때만)
      const characterConsistency = hasCharacters
        ? " 장면에 나오는 캐릭터의 얼굴과 외모가 참조 이미지와 일치하는지 확인하세요."
        : "";

      if (imageStyle === "animation") {
        imageGenPrompt = `${promptStart} 이 장면에 대한 애니메이션 스타일 이미지를 ${subtitleText} 만드세요: "${scene}".${characterConsistency} 
                애니메이션/만화 스타일로 그려주세요. 밝고 컬러풀한 애니메이션 아트 스타일, ${aspectRatio} 비율로 이미지를 생성하고, 
                주요 인물이나 사물이 잘리지 않도록 구도를 잡아주세요.${
                  subtitleEnabled
                    ? " 화면 하단에 한국어 자막을 자연스럽게 배치해주세요."
                    : ""
                }`;
      } else {
        imageGenPrompt = `${promptStart} 이 장면에 대한 사실적인 이미지를 ${subtitleText} 만드세요: "${scene}".${characterConsistency} 
                실사 영화 스타일, 시네마틱 ${aspectRatio} 비율로 이미지를 생성하고, 주요 인물이나 사물이 잘리지 않도록 구도를 잡아주세요.${
          subtitleEnabled
            ? " 화면 하단에 한국어 자막을 자연스럽게 배치해주세요."
            : ""
        }`;
      }
      parts.push({ text: imageGenPrompt });

      let imageResponse;
      let finalScene = scene;
      let contentPolicyRetry = false;
      let replacementInfo: Array<{ original: string; replacement: string }> =
        [];

      try {
        // 1단계: 원래 프롬프트로 시도 (재시도 로직 포함)
        imageResponse = await retryWithBackoff(
          () =>
            ai.models.generateContent({
              model: "gemini-2.5-flash-image-preview",
              contents: { parts },
              config: {
                  responseModalities: [Modality.IMAGE, Modality.TEXT],
                  aspectRatio: aspectRatio
                } as any,
            }),
          5,
          10000,
          (attempt, delay) => {
            onProgress?.(`⏳ API 한도 초과 - 영상 이미지 ${i + 1}/${sceneDescriptions.length} 생성 대기 중...\n${delay/1000}초 후 자동 재시도 (${attempt}/5)\n잠시만 기다려주세요. 작업 시간이 다소 지연될 수 있습니다.`);
          }
        );
      } catch (firstError: any) {
        // 콘텐츠 정책 위반 감지
        const errorMessage = firstError?.message || String(firstError);
        const isSafetyError =
          errorMessage.includes("SAFETY") ||
          errorMessage.includes("BLOCK") ||
          errorMessage.includes("content policy") ||
          errorMessage.includes("harmful content") ||
          errorMessage.includes("콘텐츠 정책");

        if (isSafetyError) {
          console.warn(
            `⚠️ Content policy violation detected for scene ${
              i + 1
            }, attempting with safe words...`
          );
          contentPolicyRetry = true;

          // 2단계: 안전한 단어로 교체하여 재시도
          const { replacedText, replacements } = replaceUnsafeWords(scene);
          replacementInfo = replacements;

          if (replacements.length > 0) {
            console.log(
              `🔄 Replacing words: ${replacements
                .map((r) => `"${r.original}" → "${r.replacement}"`)
                .join(", ")}`
            );

            finalScene = replacedText;

            // 새로운 parts 배열 생성 (교체된 텍스트로)
            const safeParts: any[] = [];

            // 참조 이미지 다시 추가
            if (referenceImage) {
              safeParts.push({
                inlineData: {
                  data: referenceImage,
                  mimeType: "image/jpeg",
                },
              });
              safeParts.push({
                text: "Style reference image - please maintain consistency with this visual style",
              });
            }

            // 캐릭터 참조 이미지 다시 추가
            characters.forEach((char) => {
              safeParts.push({
                inlineData: {
                  data: char.image,
                  mimeType: "image/jpeg",
                },
              });
              safeParts.push({
                text: `Reference image for character: ${char.name}`,
              });
            });

            // 교체된 장면 설명으로 새 프롬프트 생성
            const safeImageGenPrompt = imageGenPrompt.replace(
              scene,
              replacedText
            );
            const { replacedText: fullySafePrompt } =
              replaceUnsafeWords(safeImageGenPrompt);
            safeParts.push({ text: fullySafePrompt });

            await new Promise((resolve) => setTimeout(resolve, 2000)); // 2초 지연

            imageResponse = await retryWithBackoff(
              () =>
                ai.models.generateContent({
                  model: "gemini-2.5-flash-image-preview",
                  contents: { parts: safeParts },
                  config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                    aspectRatio: aspectRatio
                  } as any,
                }),
              5,
              10000,
              (attempt, delay) => {
                onProgress?.(`⏳ 콘텐츠 필터 우회 재시도 중 - 영상 이미지 ${i + 1}/${sceneDescriptions.length}\n${delay/1000}초 후 자동 재시도 (${attempt}/5)\n잠시만 기다려주세요.`);
              }
            );
          } else {
            throw firstError; // 교체할 단어가 없으면 원래 에러 발생
          }
        } else {
          throw firstError; // 콘텐츠 정책 외 에러는 그대로 발생
        }
      }

      const imagePart = imageResponse?.candidates?.[0]?.content?.parts?.find(
        (part) => part.inlineData
      );
      if (!imagePart?.inlineData?.data) {
        console.warn(`Image generation might have failed for scene: ${scene}`);
        storyboardResults.push({
          id: self.crypto.randomUUID(),
          image: "",
          sceneDescription: scene,
        });
      } else {
        let displayDescription = scene;

        // 콘텐츠 정책 재시도로 생성된 경우 설명에 알림 추가
        if (contentPolicyRetry && replacementInfo.length > 0) {
          const replacementText = replacementInfo
            .map((r) => `"${r.original}"을(를) "${r.replacement}"(으)로`)
            .join(", ");
          displayDescription = `${scene}\n\n⚠️ 알림: 콘텐츠 정책 준수를 위해 ${replacementText} 교체하여 생성되었습니다.`;
          console.log(
            `✅ Successfully generated scene ${i + 1} with word replacement`
          );
        }

        // 이미지 비율 조정
        const resizedSceneImage = await resizeImageToAspectRatio(imagePart.inlineData.data, aspectRatio);

        storyboardResults.push({
          id: self.crypto.randomUUID(),
          image: resizedSceneImage,
          sceneDescription: displayDescription,
        });
        console.log(`Successfully generated image for scene ${i + 1}`);
      }
    } catch (error) {
      console.error(`Error generating scene ${i + 1}:`, error);
      
      // 에러 원인 분석
      let errorReason = "";
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("safety") || msg.includes("block") || msg.includes("policy")) {
          errorReason = " (콘텐츠 정책 위반 - 장면 설명을 수정해주세요)";
        } else if (msg.includes("quota") || msg.includes("limit")) {
          errorReason = " (API 사용량 초과 - 잠시 후 재시도)";
        } else if (msg.includes("network") || msg.includes("fetch")) {
          errorReason = " (네트워크 오류)";
        } else if (msg.includes("timeout")) {
          errorReason = " (시간 초과)";
        } else {
          errorReason = ` (${error.message})`;
        }
      }
      
      storyboardResults.push({
        id: self.crypto.randomUUID(),
        image: "",
        sceneDescription: `❌ 장면 ${i + 1} 생성 실패${errorReason}\n원본: ${scene}`,
      });
    }
  }

  return storyboardResults;
};

export const regenerateStoryboardImage = async (
  sceneDescription: string,
  characters: Character[],
  apiKey?: string,
  imageStyle: "realistic" | "animation" = "realistic",
  subtitleEnabled: boolean = true,
  referenceImage?: string | null,
  aspectRatio: AspectRatio = "16:9"
): Promise<string> => {
  const ai = getGoogleAI(apiKey);
  console.log(`Regenerating image for scene: ${sceneDescription}`);

  const parts: any[] = [];

  // 참조 이미지가 있는 경우 추가
  if (referenceImage) {
    parts.push({
      inlineData: {
        data: referenceImage,
        mimeType: "image/jpeg",
      },
    });
    parts.push({
      text: "Style reference image - please maintain consistency with this visual style",
    });
  }

  // 캐릭터 참조 이미지 추가 (있는 경우에만)
  characters.forEach((char) => {
    parts.push({ inlineData: { data: char.image, mimeType: "image/jpeg" } });
    parts.push({ text: `Reference image for character: ${char.name}` });
  });

  // 스타일에 따른 이미지 생성 프롬프트
  let imageGenPrompt: string;
  const subtitleText = subtitleEnabled ? "한국어 자막을 포함하여" : "자막 없이";
  const hasCharacters = characters.length > 0;
  const hasReference = referenceImage !== null && referenceImage !== undefined;

  // 프롬프트 시작 부분 (캐릭터 유무에 따라 다름)
  let promptStart = "";
  if (hasCharacters && hasReference) {
    promptStart = "제공된 참조 캐릭터 이미지와 스타일 참조 이미지를 사용하여";
  } else if (hasCharacters) {
    promptStart = "제공된 참조 캐릭터 이미지를 사용하여";
  } else if (hasReference) {
    promptStart = "제공된 스타일 참조 이미지의 시각적 일관성을 유지하면서";
  } else {
    promptStart = ""; // 둘 다 없는 경우 (이론상 발생하지 않아야 함)
  }

  // 캐릭터 일관성 안내 (캐릭터가 있을 때만)
  const characterConsistency = hasCharacters
    ? " 장면에 나오는 캐릭터의 얼굴과 외모가 참조 이미지와 일치하는지 확인하세요."
    : "";

  if (imageStyle === "animation") {
    imageGenPrompt = `${promptStart} 이 장면에 대한 애니메이션 스타일 이미지를 ${subtitleText} 만드세요: "${sceneDescription}".${characterConsistency} 
        애니메이션/만화 스타일로 그려주세요. 밝고 컬러풀한 애니메이션 아트 스타일, ${aspectRatio} 비율로 이미지를 생성하고, 
        주요 인물이나 사물이 잘리지 않도록 구도를 잡아주세요.${
          subtitleEnabled
            ? " 화면 하단에 한국어 자막을 자연스럽게 배치해주세요."
            : ""
        }`;
  } else {
    imageGenPrompt = `${promptStart} 이 장면에 대한 상세한 이미지를 ${subtitleText} 만드세요: "${sceneDescription}".${characterConsistency} 
        시네마틱 ${aspectRatio} 비율로 이미지를 생성하고, 주요 인물이나 사물이 잘리지 않도록 구도를 잡아주세요.${
      subtitleEnabled
        ? " 화면 하단에 한국어 자막을 자연스럽게 배치해주세요."
        : ""
    }`;
  }
  parts.push({ text: imageGenPrompt });

  let imageResponse;

  try {
    // 1단계: 원래 프롬프트로 시도
    imageResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: { parts },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
        aspectRatio: aspectRatio
      } as any,
    });
  } catch (firstError: any) {
    // 콘텐츠 정책 위반 감지
    const errorMessage = firstError?.message || String(firstError);
    const isSafetyError =
      errorMessage.includes("SAFETY") ||
      errorMessage.includes("BLOCK") ||
      errorMessage.includes("content policy") ||
      errorMessage.includes("harmful content") ||
      errorMessage.includes("콘텐츠 정책");

    if (isSafetyError) {
      console.warn(
        `⚠️ Content policy violation detected during regeneration, attempting with safe words...`
      );

      // 2단계: 안전한 단어로 교체하여 재시도
      const { replacedText, replacements } =
        replaceUnsafeWords(sceneDescription);

      if (replacements.length > 0) {
        console.log(
          `🔄 Replacing words: ${replacements
            .map((r) => `"${r.original}" → "${r.replacement}"`)
            .join(", ")}`
        );

        // 새로운 parts 배열 생성 (교체된 텍스트로)
        const safeParts: any[] = [];

        // 참조 이미지 다시 추가
        if (referenceImage) {
          safeParts.push({
            inlineData: {
              data: referenceImage,
              mimeType: "image/jpeg",
            },
          });
          safeParts.push({
            text: "Style reference image - please maintain consistency with this visual style",
          });
        }

        // 캐릭터 참조 이미지 다시 추가
        characters.forEach((char) => {
          safeParts.push({
            inlineData: { data: char.image, mimeType: "image/jpeg" },
          });
          safeParts.push({
            text: `Reference image for character: ${char.name}`,
          });
        });

        // 교체된 장면 설명으로 새 프롬프트 생성
        const safeImageGenPrompt = imageGenPrompt.replace(
          sceneDescription,
          replacedText
        );
        const { replacedText: fullySafePrompt } =
          replaceUnsafeWords(safeImageGenPrompt);
        safeParts.push({ text: fullySafePrompt });

        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1초 지연

        imageResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash-image-preview",
          contents: { parts: safeParts },
          config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
            aspectRatio: aspectRatio
          } as any,
        });

        console.log(`✅ Successfully regenerated with word replacement`);
      } else {
        throw firstError; // 교체할 단어가 없으면 원래 에러 발생
      }
    } else {
      throw firstError; // 콘텐츠 정책 외 에러는 그대로 발생
    }
  }

  const imagePart = imageResponse?.candidates?.[0]?.content?.parts?.find(
    (part) => part.inlineData
  );
  if (!imagePart?.inlineData?.data) {
    throw new Error(formatErrorMessage(
      { message: "No image data returned from API" },
      `Regenerate storyboard: ${sceneDescription.substring(0, 50)}...`
    ));
  }

  // 이미지 비율 조정
  const resizedStoryboardImage = await resizeImageToAspectRatio(imagePart.inlineData.data, aspectRatio);
  return resizedStoryboardImage;
};

// 카메라 앵글 정보 매핑
const CAMERA_ANGLES: Array<{
  angle: CameraAngle;
  nameKo: string;
  description: string;
  prompt: string;
}> = [
  {
    angle: 'Front View',
    nameKo: '정면',
    description: '피사체를 정면에서 촬영',
    prompt: 'front view, facing camera directly, centered composition, straight forward angle'
  },
  {
    angle: 'Right Side View',
    nameKo: '오른쪽 측면',
    description: '피사체의 오른쪽 측면 촬영',
    prompt: 'right side profile view, camera positioned to the RIGHT side of the subject, subject facing LEFT (towards camera left), showing the RIGHT ear and RIGHT side of face, 90 degree angle, lateral right side view, subject looking towards the left edge of the frame'
  },
  {
    angle: 'Left Side View',
    nameKo: '왼쪽 측면',
    description: '피사체의 왼쪽 측면 촬영',
    prompt: 'left side profile view, camera positioned to the LEFT side of the subject, subject facing RIGHT (towards camera right), showing the LEFT ear and LEFT side of face, 90 degree angle, lateral left side view, subject looking towards the right edge of the frame'
  },
  {
    angle: 'Back View',
    nameKo: '뒷모습',
    description: '피사체의 뒷모습 촬영',
    prompt: 'back view, rear view, view from behind, backside perspective'
  },
  {
    angle: 'Full Body',
    nameKo: '전신',
    description: '머리부터 발끝까지 전체 촬영',
    prompt: 'full body shot, head to toe, complete figure, full length view, showing entire body from head to feet'
  },
  {
    angle: 'Close-up Face',
    nameKo: '얼굴 근접',
    description: '얼굴을 가까이 촬영',
    prompt: 'close-up face, facial close-up, tight shot of face, detailed facial features'
  }
];

/**
 * 선택한 카메라 앵글로 이미지 생성
 * Gemini Vision으로 이미지 분석 → Imagen으로 앵글 변환 생성
 * @param sourceImage - base64 인코딩된 원본 이미지
 * @param selectedAngles - 선택한 앵글 배열
 * @param apiKey - Google AI API 키
 * @param aspectRatio - 출력 이미지 비율
 * @param onProgress - 진행 상황 콜백
 * @returns 선택한 카메라 앵글 이미지 배열
 */
export const generateCameraAngles = async (
  sourceImage: string,
  selectedAngles: CameraAngle[],
  apiKey?: string,
  aspectRatio: AspectRatio = "16:9",
  onProgress?: (message: string, current: number, total: number) => void
): Promise<CameraAngleImage[]> => {
  const ai = getGoogleAI(apiKey);
  const results: CameraAngleImage[] = [];
  
  // 선택된 앵글 필터링
  const anglesToGenerate = CAMERA_ANGLES.filter(a => selectedAngles.includes(a.angle));
  const totalAngles = anglesToGenerate.length;

  if (totalAngles === 0) {
    throw new Error("생성할 앵글을 최소 1개 이상 선택해주세요.");
  }

  console.log(`🎬 Starting camera angle generation for ${totalAngles} angles...`);
  
  // Step 1: Gemini Vision으로 원본 이미지 상세 분석
  onProgress?.("원본 이미지 분석 중...", 0, totalAngles);
  
  const base64Data = sourceImage.includes(',') 
    ? sourceImage.split(',')[1] 
    : sourceImage;

  let imageAnalysis = "";
  
  try {
    console.log("📸 Analyzing source image with Gemini Vision...");
    
    const analysisPrompt = `🎯 CRITICAL TASK: Analyze this image with EXTREME precision to recreate THE EXACT SAME SUBJECT from different camera angles.

⚠️ MOST IMPORTANT: This analysis will be used to generate multiple images of the SAME person/object from different angles. Be HYPER-SPECIFIC about identifying features that make this subject UNIQUE and RECOGNIZABLE.

📸 DETAILED ANALYSIS REQUIRED:

1. PRIMARY SUBJECT IDENTITY (MOST CRITICAL):
   If PERSON:
   - Estimated age (exact: e.g., "approximately 65-70 years old")
   - Gender and ethnicity (specific)
   - FACIAL FEATURES (BE VERY SPECIFIC):
     * Face shape (round, oval, square, rectangular, triangular)
     * Skin tone (exact description: fair, tan, olive, brown, dark, etc.)
     * Distinctive facial characteristics (wrinkles, laugh lines, facial hair pattern, moles, scars)
     * Eyes: color, shape, size, eyebrow shape and thickness
     * Nose: shape, size, distinctive features
     * Mouth and lips: shape, size, expression
     * Facial hair: exact style (clean-shaven, mustache style, beard style, color, length)
     * Hair: exact color, style, length, texture, receding hairline, gray areas
     * Facial expression: exact mood (serious, smiling, neutral, etc.)
   
   If OBJECT/ANIMAL:
   - Exact type and species
   - Unique identifying features
   - Color patterns and markings
   - Size and proportions
   - Distinctive characteristics

2. CLOTHING & ACCESSORIES (EXACT DETAILS):
   - Upper body: exact garment type, color, pattern, style
   - Lower body: exact details
   - Accessories: glasses (exact style), jewelry, watches, hats, etc.
   - Fabric texture and material appearance

3. BODY POSTURE & POSITION:
   - Exact pose (sitting, standing, leaning, etc.)
   - Body orientation
   - Limb positions
   - Head tilt and direction

4. LIGHTING & PHOTOGRAPHY STYLE:
   - Light source: direction, quality (soft/harsh), color temperature
   - Shadows: position and intensity
   - Highlight areas
   - Overall lighting mood
   - Photography style (portrait, candid, professional, etc.)

5. BACKGROUND & ENVIRONMENT:
   - Setting type (indoor/outdoor, studio, etc.)
   - Background colors and elements
   - Depth of field (blurred/sharp background)
   - Environmental context

6. CURRENT CAMERA SETUP:
   - Current viewing angle (front, 3/4, profile, etc.)
   - Distance from subject (close-up, medium, full body)
   - Focal length feel (wide, normal, telephoto)

🎯 REMEMBER: The goal is to generate images of THIS EXACT SAME PERSON/OBJECT from different angles while maintaining ALL identifying characteristics. Be as detailed as possible about what makes this subject UNIQUE.`;

    const result = await retryWithBackoff(
      () =>
        ai.models.generateContent({
          model: "gemini-2.5-flash-image-preview",
          contents: {
            parts: [
              { text: analysisPrompt },
              { 
                inlineData: {
                  mimeType: sourceImage.startsWith('data:image/png') ? "image/png" : "image/jpeg",
                  data: base64Data
                }
              }
            ]
          },
          config: {
            responseModalities: [Modality.TEXT],
            temperature: 0.1, // 낮은 온도로 일관성 향상
          }
        }),
      5,
      10000,
      (attempt, delay) => {
        onProgress?.(`⏳ API 한도 초과 - 원본 이미지 분석 대기 중...\n${delay/1000}초 후 자동 재시도 (${attempt}/5)\n잠시만 기다려주세요.`, 0, anglesToGenerate.length);
      }
    );

    imageAnalysis = result.text || "";
    console.log(`✅ Image analysis complete (${imageAnalysis.length} characters)`);
    console.log(`📋 Analysis preview: ${imageAnalysis.substring(0, 300)}...`);
    
  } catch (error) {
    console.error("❌ Image analysis failed:", error);
    throw new Error(formatErrorMessage(error, "Image analysis for camera angles"));
  }

  // Step 2: 분석 결과를 바탕으로 각 앵글별 이미지 생성
  for (let i = 0; i < anglesToGenerate.length; i++) {
    const angleInfo = anglesToGenerate[i];
    console.log(`Processing angle ${i + 1}/${totalAngles}: ${angleInfo.nameKo}`);
    onProgress?.(
      `${angleInfo.nameKo} (${i + 1}/${totalAngles}) 생성 중...`,
      i + 1,
      totalAngles
    );

    try {
      // API 과부하 방지: 5-6초 지연
      if (i > 0) {
        const delay = 5000 + Math.random() * 1000;
        console.log(`⏳ Waiting ${Math.round(delay / 1000)}s before next request...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      // 이미지 분석 결과 + 원본 이미지 + 앵글 지시를 결합
      const detailedPrompt = `🎯 TRANSFORM THIS IMAGE TO SHOW THE EXACT SAME SUBJECT FROM A DIFFERENT CAMERA ANGLE

� ORIGINAL IMAGE: The image provided above shows the subject from the current angle.

🎬 NEW CAMERA ANGLE REQUIREMENT:
${angleInfo.prompt}

⚠️ CRITICAL REQUIREMENTS (MUST FOLLOW):
1. IDENTITY PRESERVATION: Keep THE EXACT SAME person/object from the original image
   - Same age, same facial features, same hair, same skin tone
   - Same clothing and accessories
   - Same overall appearance and characteristics
   
2. CONSISTENCY RULES:
   - Keep ALL physical characteristics IDENTICAL to the original image
   - Maintain the same lighting quality and mood
   - Preserve the same clothing and style
   - ONLY CHANGE: the camera viewing angle to match: ${angleInfo.prompt}
   
3. TECHNICAL SPECS:
   - Aspect ratio: ${aspectRatio}
   - Photography style: Same as original (professional, high quality)
   - Focus: Sharp, clear, well-lit
   - Quality: Professional photography standard

🎯 GOAL: Generate a new image showing the SAME subject from the original image, but viewed from the requested camera angle: ${angleInfo.nameKo}.

Generate the transformed image showing the same subject from the new angle.`;

      console.log(`📸 Generating ${angleInfo.nameKo} with image transformation (${detailedPrompt.length} chars)`);

      // Gemini 2.5 Flash Image Preview를 사용하여 이미지 변환
      const imageResponse = await retryWithBackoff(
        async () => {
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-image-preview",
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: sourceImage.startsWith('data:image/png') ? "image/png" : "image/jpeg",
                    data: base64Data
                  }
                },
                { text: detailedPrompt }
              ]
            },
            config: {
              responseModalities: [Modality.IMAGE],
              temperature: 0.2, // 낮은 온도로 일관성 유지
            }
          });

          return response;
        },
        5,
        10000,
        (attempt, delay) => {
          onProgress?.(`⏳ API 한도 초과 - ${angleInfo.nameKo} 생성 대기 중...\n${delay/1000}초 후 자동 재시도 (${attempt}/5)\n잠시만 기다려주세요.`, i + 1, totalAngles);
        }
      );

      // Gemini의 이미지 응답에서 이미지 추출
      const imagePart = imageResponse?.candidates?.[0]?.content?.parts?.find(
        (part) => part.inlineData
      );

      if (!imagePart?.inlineData?.data) {
        throw new Error(formatErrorMessage(
          { message: "No image data returned from API" },
          `Camera angle: ${angleInfo.nameKo}`
        ));
      }

      const base64Image = `data:image/png;base64,${imagePart.inlineData.data}`;

      results.push({
        id: self.crypto.randomUUID(),
        angle: angleInfo.angle,
        image: base64Image,
        angleName: angleInfo.nameKo,
        description: angleInfo.description,
      });

      console.log(`✅ Successfully generated ${angleInfo.nameKo}`);
      
    } catch (error) {
      console.error(`❌ Error generating ${angleInfo.nameKo}:`, error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Quota 초과 시 즉시 중단
      if (errorMessage.includes("QUOTA") || 
          errorMessage.includes("429") ||
          errorMessage.includes("quota") ||
          errorMessage.includes("exceeded") ||
          errorMessage.includes("RESOURCE_EXHAUSTED")) {
        
        const generated = i;
        throw new Error(
          `❌ API 요청 속도 제한 (429 Error)\n\n` +
          `✅ ${generated}개 앵글 생성 완료\n` +
          `⏸️ 나머지 ${totalAngles - generated}개는 대기\n\n` +
          `📊 원인:\n` +
          `• 분당 요청 횟수 초과 (RPM)\n` +
          `• 초당 토큰 수 초과 (TPM)\n\n` +
          `💡 해결 방법:\n` +
          `1. 1-2분 후 다시 시도\n` +
          `2. Google Cloud Console → Quotas 확인\n` +
          `3. 생성된 이미지는 먼저 다운로드하세요`
        );
      }
      
      // 네트워크 에러
      if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
        throw new Error(
          `❌ 네트워크 오류\n\n` +
          `✅ ${i}개 앵글 생성 완료\n\n` +
          `💡 인터넷 연결을 확인하고 다시 시도하세요`
        );
      }
      
      // 기타 에러 처리
      const formattedError = formatErrorMessage(error, `Camera angle: ${angleInfo.nameKo}`);
      
      results.push({
        id: self.crypto.randomUUID(),
        angle: angleInfo.angle,
        image: "",
        angleName: angleInfo.nameKo,
        description: `생성 실패: ${formattedError.split('\n')[0].replace('❌ ', '')}`,
      });
      
      console.warn(`⚠️ Continuing with remaining angles...`);
    }
  }

  const successCount = results.filter(r => r.image && r.image.trim() !== "").length;
  console.log(`🎉 Camera angle generation completed: ${successCount}/${totalAngles} successful`);
  
  onProgress?.(`완료: ${successCount}/${totalAngles}개 생성됨`, totalAngles, totalAngles);

  return results;
};
