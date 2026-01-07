import React, { useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import JSZip from "jszip";
import {
  Character,
  VideoSourceImage,
  AspectRatio,
  ImageStyle,
  CharacterStyle,
  BackgroundStyle,
  PhotoComposition,
  CameraAngleImage,
  CameraAngle,
} from "./types";
import * as geminiService from "./services/geminiService";
import { testApiKey } from "./services/apiTest";
import {
  detectUnsafeWords,
  replaceUnsafeWords,
  isTextSafe,
} from "./utils/contentSafety";
import {
  saveApiKey,
  loadApiKey,
  clearApiKey,
  isRememberMeEnabled,
} from "./utils/apiKeyStorage";
import { compressImage, canStoreInLocalStorage } from "./utils/imageCompression";
import AspectRatioSelector from "./components/AspectRatioSelector";
import Spinner from "./components/Spinner";
import CharacterCard from "./components/CharacterCard";
import StoryboardImage from "./components/StoryboardImage";
import Slider from "./components/Slider";
import MetaTags from "./components/MetaTags";
import ApiKeyGuide from "./components/ApiKeyGuide";
import UserGuide from "./components/UserGuide";
import AdBanner from "./components/AdBanner";
import FloatingBottomAd from "./components/FloatingBottomAd";
import SideFloatingAd from "./components/SideFloatingAd";
import AdBlockDetector from "./components/AdBlockDetector";

type ImageAppView = "main" | "api-guide" | "user-guide" | "image-prompt";

interface ImageAppProps {
  basePath?: string;
  initialScript?: string;
}

const App: React.FC<ImageAppProps> = ({
  basePath = "/image",
  initialScript = "",
}) => {
  const [currentView, setCurrentView] = useState<ImageAppView>("main");
  const navigate = useNavigate();
  const location = useLocation();
  const navigationScript =
    ((location.state as { script?: string } | null)?.script) || "";
  const normalizedBasePath =
    basePath && basePath !== "/" ? basePath.replace(/\/$/, "") : "";
  const [apiKey, setApiKey] = useState<string>("");
  const [rememberApiKey, setRememberApiKey] = useState<boolean>(true);
  const [imageStyle, setImageStyle] = useState<"realistic" | "animation">(
    "realistic"
  ); // 기존 이미지 스타일 (실사/애니메이션)
  const [personaStyle, setPersonaStyle] = useState<ImageStyle>("실사 극대화"); // 기존 페르소나 스타일 (호환성 유지)
  const [characterStyle, setCharacterStyle] =
    useState<CharacterStyle>("실사 극대화"); // 인물 스타일
  const [backgroundStyle, setBackgroundStyle] =
    useState<BackgroundStyle>("모던"); // 배경/분위기 스타일
  const [customCharacterStyle, setCustomCharacterStyle] = useState<string>(""); // 커스텀 인물 스타일
  const [customBackgroundStyle, setCustomBackgroundStyle] =
    useState<string>(""); // 커스텀 배경 스타일
  const [customStyle, setCustomStyle] = useState<string>(""); // 커스텀 스타일 입력 (기존 호환성)
  const [photoComposition, setPhotoComposition] =
    useState<PhotoComposition>("정면"); // 사진 구도
  const [customPrompt, setCustomPrompt] = useState<string>(""); // 커스텀 이미지 프롬프트
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9"); // 이미지 비율 선택
  const [personaInput, setPersonaInput] = useState<string>(""); // 페르소나 생성용 입력
  const [videoSourceScript, setVideoSourceScript] = useState<string>(""); // 영상 소스용 대본
  const [subtitleEnabled, setSubtitleEnabled] = useState<boolean>(false); // 자막 포함 여부 - 기본 OFF
  const [personaReferenceImage, setPersonaReferenceImage] = useState<
    string | null
  >(null); // 페르소나용 참조 이미지 (선택사항)
  const [referenceImage, setReferenceImage] = useState<string | null>(null); // 영상 소스용 참조 이미지
  const [characters, setCharacters] = useState<Character[]>([]);
  const [videoSource, setVideoSource] = useState<VideoSourceImage[]>([]);
  const [imageCount, setImageCount] = useState<number>(5);
  const [isLoadingCharacters, setIsLoadingCharacters] =
    useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<string>(""); // 로딩 진행 상황 메시지
  const [isLoadingVideoSource, setIsLoadingVideoSource] =
    useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [personaError, setPersonaError] = useState<string | null>(null);
  const [contentWarning, setContentWarning] = useState<{
    unsafeWords: string[];
    replacements: Array<{ original: string; replacement: string }>;
  } | null>(null);
  const [isContentWarningAcknowledged, setIsContentWarningAcknowledged] =
    useState<boolean>(false);
  const [hasContentWarning, setHasContentWarning] = useState<boolean>(false);
  const [hoveredStyle, setHoveredStyle] = useState<string | null>(null); // 호버된 스타일
  
  // 카메라 앵글 기능 관련 state
  const [cameraAngleSourceImage, setCameraAngleSourceImage] = useState<string | null>(null);
  const [selectedCameraAngles, setSelectedCameraAngles] = useState<CameraAngle[]>([
    'Front View', 'Right Side View', 'Left Side View', 'Back View', 'Full Body', 'Close-up Face'
  ]); // 기본값: 전체 선택
  const [cameraAngles, setCameraAngles] = useState<CameraAngleImage[]>([]);
  const [isLoadingCameraAngles, setIsLoadingCameraAngles] = useState<boolean>(false);
  const [cameraAngleProgress, setCameraAngleProgress] = useState<string>("");
  const [cameraAngleError, setCameraAngleError] = useState<string | null>(null);

  // URL 기반 현재 뷰 결정
  useEffect(() => {
    const path = decodeURIComponent(location.pathname);
    const relativePath =
      normalizedBasePath && path.startsWith(normalizedBasePath)
        ? path.slice(normalizedBasePath.length) || "/"
        : path;

    if (
      relativePath === "/api-guide" ||
      (relativePath.includes("api") && relativePath.includes("가이드"))
    ) {
      setCurrentView("api-guide");
    } else if (
      relativePath === "/user-guide" ||
      (relativePath.includes("사용법") && relativePath.includes("가이드"))
    ) {
      setCurrentView("user-guide");
    } else if (relativePath === "/image-prompt") {
      setCurrentView("image-prompt");
    } else {
      setCurrentView("main");
    }
  }, [location.pathname, normalizedBasePath]);

  const navigateToView = useCallback(
    (view: ImageAppView) => {
      setCurrentView(view);
      const suffix =
        view === "api-guide"
          ? "/api-guide"
          : view === "user-guide"
            ? "/user-guide"
            : view === "image-prompt"
              ? "/image-prompt"
              : "";
      const targetPath =
        ((normalizedBasePath || "") + suffix) || "/";
      navigate(targetPath, { replace: true });
    },
    [navigate, normalizedBasePath]
  );

  // 컴포넌트 마운트 시 저장된 API 키 로딩
  useEffect(() => {
    const savedApiKey = loadApiKey();
    if (savedApiKey) {
      setApiKey(savedApiKey);
      setRememberApiKey(isRememberMeEnabled());
    }
  }, []);

  // 컴포넌트 마운트 시 저장된 작업 데이터 불러오기 (localStorage 우선, 없으면 sessionStorage)
  useEffect(() => {
    try {
      let savedData = localStorage.getItem("youtube_image_work_data");
      let source = "localStorage";
      
      // localStorage에 없으면 sessionStorage 확인
      if (!savedData) {
        savedData = sessionStorage.getItem("youtube_image_work_data");
        source = "sessionStorage";
      }
      
      console.log(`🔍 ${source}에서 데이터 불러오기 시도...`, savedData ? `${savedData.length} bytes` : "없음");
      
      if (savedData) {
        const parsed = JSON.parse(savedData);
        console.log("📦 파싱된 데이터:", {
          characters: parsed.characters?.length || 0,
          videoSource: parsed.videoSource?.length || 0,
          cameraAngles: parsed.cameraAngles?.length || 0,
          savedAt: parsed.savedAt,
          version: parsed.version,
        });
        
        // 복원된 항목 카운트
        let restoredCount = 0;
        const restoredItems: string[] = [];
        
        if (parsed.characters && parsed.characters.length > 0) {
          setCharacters(parsed.characters);
          restoredCount++;
          restoredItems.push(`페르소나: ${parsed.characters.length}개`);
          console.log("✅ 페르소나 복원:", parsed.characters.length, "개");
        }
        if (parsed.videoSource && parsed.videoSource.length > 0) {
          setVideoSource(parsed.videoSource);
          restoredCount++;
          restoredItems.push(`영상소스: ${parsed.videoSource.length}개`);
          console.log("✅ 영상 소스 복원:", parsed.videoSource.length, "개");
        }
        if (parsed.cameraAngles && parsed.cameraAngles.length > 0) {
          setCameraAngles(parsed.cameraAngles);
          restoredCount++;
          restoredItems.push(`카메라앵글: ${parsed.cameraAngles.length}개`);
          console.log("✅ 카메라 앵글 복원:", parsed.cameraAngles.length, "개");
        }
        
        // 설정 복원
        if (parsed.personaInput) setPersonaInput(parsed.personaInput);
        if (parsed.videoSourceScript)
          setVideoSourceScript(parsed.videoSourceScript);
        if (parsed.personaReferenceImage) {
          setPersonaReferenceImage(parsed.personaReferenceImage);
          restoredItems.push("페르소나 참조 이미지 ✓");
          console.log("✅ 페르소나 참조 이미지 복원");
        }
        if (parsed.referenceImage) {
          setReferenceImage(parsed.referenceImage);
          restoredItems.push("영상소스 참조 이미지 ✓");
          console.log("✅ 영상소스 참조 이미지 복원");
        }
        if (parsed.imageStyle) setImageStyle(parsed.imageStyle);
        if (parsed.personaStyle) setPersonaStyle(parsed.personaStyle);
        if (parsed.customCharacterStyle) setCustomCharacterStyle(parsed.customCharacterStyle);
        if (parsed.customBackgroundStyle) setCustomBackgroundStyle(parsed.customBackgroundStyle);
        if (parsed.customStyle) setCustomStyle(parsed.customStyle);
        if (parsed.photoComposition) setPhotoComposition(parsed.photoComposition);
        if (parsed.customPrompt) setCustomPrompt(parsed.customPrompt);
        if (parsed.selectedCameraAngles && parsed.selectedCameraAngles.length > 0) {
          setSelectedCameraAngles(parsed.selectedCameraAngles);
        }
        if (parsed.characterStyle) setCharacterStyle(parsed.characterStyle);
        if (parsed.backgroundStyle) setBackgroundStyle(parsed.backgroundStyle);
        if (parsed.aspectRatio) setAspectRatio(parsed.aspectRatio);
        if (parsed.imageCount) setImageCount(parsed.imageCount);
        if (parsed.subtitleEnabled !== undefined)
          setSubtitleEnabled(parsed.subtitleEnabled);
        if (parsed.cameraAngleSourceImage) {
          setCameraAngleSourceImage(parsed.cameraAngleSourceImage);
          restoredItems.push("카메라앵글 원본 이미지 ✓");
          console.log("✅ 카메라 앵글 원본 이미지 복원");
        }
        
        console.log(`🎉 작업 데이터 복원 완료 (from ${source}):`, {
          페르소나: parsed.characters?.length || 0,
          영상소스: parsed.videoSource?.length || 0,
          카메라앵글: parsed.cameraAngles?.length || 0,
          savedAt: parsed.savedAt ? new Date(parsed.savedAt).toLocaleString('ko-KR') : 'unknown',
        });
        
        // 복원 성공 시 콘솔에만 로그 (알림창 제거)
        if (restoredCount > 0 || restoredItems.length > 0) {
          // 마지막 작업 유형 파악 (저장된 값 우선 사용)
          let lastWorkType = parsed.lastWorkType || '';
          
          // lastWorkType이 저장되지 않은 경우 (이전 버전 호환성)
          if (!lastWorkType) {
            if (parsed.cameraAngles?.length > 0) {
              lastWorkType = '카메라앵글 변환';
            } else if (parsed.videoSource?.length > 0) {
              lastWorkType = '영상소스 생성';
            } else if (parsed.characters?.length > 0) {
              lastWorkType = '페르소나 생성';
            }
          }
          
          const savedTime = parsed.savedAt ? new Date(parsed.savedAt).toLocaleString('ko-KR') : '알 수 없음';
          
          console.log("🎊 복원 완료!");
          console.log(`📌 마지막 작업: ${lastWorkType}`);
          console.log(`⏰ 저장 시각: ${savedTime}`);
          console.log(`📦 복원된 항목: ${restoredItems.join(', ')}`);
        } else {
          console.log("ℹ️ 복원할 작업물이 없습니다 (설정만 복원됨)");
        }
      } else {
        console.log("ℹ️ 저장된 데이터 없음 (localStorage & sessionStorage 모두)");
      }
    } catch (e) {
      console.error("❌ 작업 데이터 불러오기 실패:", e);
      // 손상된 데이터 삭제
      localStorage.removeItem("youtube_image_work_data");
      sessionStorage.removeItem("youtube_image_work_data");
      alert("⚠️ 저장된 데이터가 손상되어 불러올 수 없습니다.\n새로 시작해주세요.");
    }
  }, []);

  useEffect(() => {
    const scriptToApply = initialScript || navigationScript;
    if (scriptToApply && !videoSourceScript.trim()) {
      setVideoSourceScript(scriptToApply);
    }
  }, [initialScript, navigationScript, videoSourceScript]);

  // 저장 함수를 별도로 분리 (즉시 저장 가능하도록)
  const saveDataToStorage = useCallback(async (immediate = false) => {
    // 저장할 데이터가 없으면 스킵
    const hasWorkData =
      characters.length > 0 ||
      videoSource.length > 0 ||
      cameraAngles.length > 0 ||
      Boolean(personaInput.trim()) ||
      Boolean(videoSourceScript.trim()) ||
      Boolean(personaReferenceImage) ||
      Boolean(referenceImage) ||
      Boolean(customPrompt.trim()) ||
      Boolean(customStyle.trim()) ||
      Boolean(customCharacterStyle.trim()) ||
      Boolean(customBackgroundStyle.trim()) ||
      Boolean(cameraAngleSourceImage);

    if (!hasWorkData) {
      return;
    }

    const timestamp = new Date().toLocaleTimeString('ko-KR');
    console.log(`💾 [${timestamp}] 데이터 저장 시작${immediate ? ' (즉시 저장)' : ''}:`, {
      페르소나: characters.length,
      영상소스: videoSource.length,
      카메라앵글: cameraAngles.length
    });
      
    try {
      // 이미지 압축 (용량 최적화)
      console.log(`🗜️ [${timestamp}] 이미지 압축 시작...`);
      const compressedCharacters = await Promise.all(
        characters.slice(0, 10).map(async (char, idx) => {
          console.log(`  - 페르소나 #${idx + 1} 압축 중...`);
          return {
            ...char,
            image: char.image ? await compressImage(char.image, 600, 0.6) : char.image,
          };
        })
      );
      console.log(`✅ [${timestamp}] 페르소나 ${compressedCharacters.length}개 압축 완료`);

      const compressedVideoSource = await Promise.all(
        videoSource.slice(0, 10).map(async (source, idx) => {
          console.log(`  - 영상소스 #${idx + 1} 압축 중...`);
          return {
            ...source,
            image: source.image ? await compressImage(source.image, 600, 0.6) : source.image,
          };
        })
      );
      console.log(`✅ [${timestamp}] 영상소스 ${compressedVideoSource.length}개 압축 완료`);

      const compressedCameraAngles = await Promise.all(
        cameraAngles.slice(0, 10).map(async (angle, idx) => {
          console.log(`  - 카메라앵글 #${idx + 1} 압축 중...`);
          return {
            ...angle,
            image: angle.image ? await compressImage(angle.image, 600, 0.6) : angle.image,
          };
        })
      );
      console.log(`✅ [${timestamp}] 카메라앵글 ${compressedCameraAngles.length}개 압축 완료`);

      // 마지막 작업 유형 결정 (가장 최근 작업)
      let lastWorkType = '';
      if (compressedCameraAngles.length > 0) {
        lastWorkType = '카메라앵글 변환';
      } else if (compressedVideoSource.length > 0) {
        lastWorkType = '영상소스 생성';
      } else if (compressedCharacters.length > 0) {
        lastWorkType = '페르소나 생성';
      }

      const dataToSave: any = {
        characters: compressedCharacters,
        videoSource: compressedVideoSource,
        personaInput,
        videoSourceScript,
        personaStyle,
        customCharacterStyle,
        customBackgroundStyle,
        customStyle,
        photoComposition,
        customPrompt,
        selectedCameraAngles,
        personaReferenceImage: personaReferenceImage 
          ? await compressImage(personaReferenceImage, 400, 0.5) 
          : null,
        referenceImage: referenceImage 
          ? await compressImage(referenceImage, 400, 0.5) 
          : null,
        imageStyle,
        characterStyle,
        backgroundStyle,
        aspectRatio,
        imageCount,
        subtitleEnabled,
        cameraAngleSourceImage: cameraAngleSourceImage 
          ? await compressImage(cameraAngleSourceImage, 600, 0.6) 
          : null,
        cameraAngles: compressedCameraAngles,
        savedAt: new Date().toISOString(),
        version: "1.0.0", // 버전 추가로 호환성 관리
      };

      // lastWorkType이 있는 경우에만 추가
      if (lastWorkType) {
        dataToSave.lastWorkType = lastWorkType;
      }

      const jsonString = JSON.stringify(dataToSave);
      const sizeInMB = (jsonString.length / 1024 / 1024).toFixed(2);
      console.log(`📊 [${timestamp}] 저장할 데이터 크기: ${sizeInMB}MB (${jsonString.length} bytes)`);

      // localStorage 용량 체크 (4MB 제한)
      if (!canStoreInLocalStorage(jsonString, 4)) {
        console.warn(`⚠️ [${timestamp}] 데이터가 너무 커서 일부만 저장합니다.`);
        // 용량 초과 시 카메라 앵글 제외하고 재시도
        const minimalData = {
          ...dataToSave,
          cameraAngles: [],
        };
        const minimalJsonString = JSON.stringify(minimalData);
        
        if (!canStoreInLocalStorage(minimalJsonString, 4)) {
          console.warn(`⚠️ [${timestamp}] 여전히 용량 초과, 영상 소스도 제외합니다.`);
          const veryMinimalData = {
            ...minimalData,
            videoSource: [],
          };
          localStorage.setItem("youtube_image_work_data", JSON.stringify(veryMinimalData));
          sessionStorage.setItem("youtube_image_work_data", JSON.stringify(veryMinimalData));
          console.log(`✅ [${timestamp}] 최소 데이터만 저장됨 (페르소나 + 설정)`);
        } else {
          localStorage.setItem("youtube_image_work_data", minimalJsonString);
          sessionStorage.setItem("youtube_image_work_data", minimalJsonString);
          console.log(`✅ [${timestamp}] 일부 데이터 저장됨 (카메라 앵글 제외)`);
        }
      } else {
        localStorage.setItem("youtube_image_work_data", jsonString);
        sessionStorage.setItem("youtube_image_work_data", jsonString);
        console.log(`✅ [${timestamp}] 전체 데이터 저장 완료! (localStorage + sessionStorage 이중 백업)`);
      }
    } catch (e) {
      if (e instanceof Error && e.name === "QuotaExceededError") {
        console.error("❌ localStorage 용량 초과! 이전 데이터를 삭제합니다.");
        localStorage.removeItem("youtube_image_work_data");
        sessionStorage.removeItem("youtube_image_work_data");
        try {
          // 최소 데이터만 저장
          const minimalData = {
            personaInput,
            videoSourceScript,
            personaStyle,
            customCharacterStyle,
            customBackgroundStyle,
            customStyle,
            photoComposition,
            customPrompt,
            selectedCameraAngles,
            imageStyle,
            characterStyle,
            backgroundStyle,
            aspectRatio,
            imageCount,
            subtitleEnabled,
            savedAt: new Date().toISOString(),
          };
          localStorage.setItem("youtube_image_work_data", JSON.stringify(minimalData));
          console.log("✅ 설정 데이터만 저장됨");
        } catch (retryError) {
          console.error("❌ 재시도도 실패:", retryError);
        }
      } else {
        console.error("❌ 작업 데이터 저장 실패:", e);
      }
    }
  }, [
    characters,
    videoSource,
    personaInput,
    videoSourceScript,
    personaStyle,
    customCharacterStyle,
    customBackgroundStyle,
    customStyle,
    photoComposition,
    customPrompt,
    selectedCameraAngles,
    personaReferenceImage,
    referenceImage,
    imageStyle,
    characterStyle,
    backgroundStyle,
    aspectRatio,
    imageCount,
    subtitleEnabled,
    cameraAngleSourceImage,
    cameraAngles,
  ]);

  // 작업 데이터가 변경될 때마다 localStorage + sessionStorage에 저장 (이중 백업)
  useEffect(() => {
    // 초기 마운트 시에는 저장하지 않음 (데이터 로드 후에만 저장)
    const hasData =
      characters.length > 0 ||
      videoSource.length > 0 ||
      cameraAngles.length > 0 ||
      Boolean(personaInput.trim()) ||
      Boolean(videoSourceScript.trim()) ||
      Boolean(personaReferenceImage) ||
      Boolean(referenceImage) ||
      Boolean(customPrompt.trim()) ||
      Boolean(customStyle.trim()) ||
      Boolean(customCharacterStyle.trim()) ||
      Boolean(customBackgroundStyle.trim()) ||
      Boolean(cameraAngleSourceImage);
    
    if (!hasData) {
      return; // 데이터가 없으면 저장하지 않음
    }
    
    // debounce를 위해 타이머 사용
    const timer = setTimeout(() => {
      console.log('💾 자동 저장 트리거 (1초 debounce 후)');
      saveDataToStorage(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    saveDataToStorage,
    characters.length,
    videoSource.length,
    cameraAngles.length,
    personaInput,
    videoSourceScript,
    personaReferenceImage,
    referenceImage,
    customPrompt,
    customStyle,
    customCharacterStyle,
    customBackgroundStyle,
    cameraAngleSourceImage,
  ]);

  // 보안: 드래그, 우클릭, 캡처 방지
  useEffect(() => {
    // 입력 필드인지 확인하는 헬퍼 함수
    const isInputField = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false;
      const tagName = target.tagName.toLowerCase();
      return (
        tagName === "input" ||
        tagName === "textarea" ||
        target.isContentEditable
      );
    };

    // 드래그, 선택, 우클릭, 복사 차단 (입력 필드 제외)
    const preventDefaultExceptInput = (e: Event) => {
      if (!isInputField(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    document.addEventListener("contextmenu", preventDefaultExceptInput, {
      capture: true,
    });
    document.addEventListener("selectstart", preventDefaultExceptInput, {
      capture: true,
    });
    document.addEventListener("dragstart", preventDefaultExceptInput, {
      capture: true,
    });
    document.addEventListener("copy", preventDefaultExceptInput, {
      capture: true,
    });
    document.addEventListener("cut", preventDefaultExceptInput, {
      capture: true,
    });

    // 마우스 우클릭 차단 (드래그프리류 우회 방지, 입력 필드 제외)
    const blockRightClick = (e: MouseEvent) => {
      if (e.button === 2 && !isInputField(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };
    document.addEventListener("mousedown", blockRightClick, { capture: true });
    document.addEventListener("mouseup", blockRightClick, { capture: true });

    // CSS로 선택 방지 (입력 필드는 스타일로 예외 처리)
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    // 입력 필드는 선택 가능하도록 스타일 추가
    const style = document.createElement("style");
    style.textContent = `
      input, textarea, [contenteditable="true"] {
        user-select: text !important;
        -webkit-user-select: text !important;
      }
    `;
    document.head.appendChild(style);

    // 키보드 단축키 차단 (입력 필드에서는 편집 단축키 허용)
    const blockKeys = (e: KeyboardEvent) => {
      const target = e.target;
      const isInput = isInputField(target);

      // 입력 필드에서는 기본 편집 단축키 허용
      // Ctrl+C (복사), Ctrl+V (붙여넣기), Ctrl+X (잘라내기), Ctrl+A (전체선택)
      // Ctrl+Z (되돌리기), Ctrl+Y (다시실행), Ctrl+Shift+Z (다시실행)
      if (isInput) {
        // 입력 필드에서 허용할 단축키
        const allowedKeys = [
          "c",
          "v",
          "x",
          "a",
          "z",
          "y",
          "C",
          "V",
          "X",
          "A",
          "Z",
          "Y",
        ];
        const key = e.key.toLowerCase();

        // Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z는 항상 허용
        if (e.ctrlKey && !e.shiftKey && (key === "z" || key === "y")) {
          return; // 이벤트 정상 진행
        }
        if (e.ctrlKey && e.shiftKey && key === "z") {
          return; // 이벤트 정상 진행
        }

        // Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A는 Shift 없을 때만 허용
        if (e.ctrlKey && !e.shiftKey && allowedKeys.includes(e.key)) {
          return; // 이벤트 정상 진행 (복사/붙여넣기/잘라내기/전체선택)
        }
      }

      // 저장/인쇄/캡처 관련 키는 모든 곳에서 차단

      // Ctrl+S (페이지 저장) - 모든 곳에서 차단
      if (e.ctrlKey && !e.shiftKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+P (인쇄) - 모든 곳에서 차단
      if (e.ctrlKey && !e.shiftKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+S (페이지 저장/스크롤 캡처) - 모든 곳에서 차단
      if (e.ctrlKey && e.shiftKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+C (직접 지정 캡처) - 입력 필드 제외하고 차단
      if (
        !isInput &&
        e.ctrlKey &&
        e.shiftKey &&
        (e.key === "c" || e.key === "C")
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+W (창 캡처) - 모든 곳에서 차단
      if (e.ctrlKey && e.shiftKey && (e.key === "w" || e.key === "W")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+D (단위영역 캡처) - 모든 곳에서 차단
      if (e.ctrlKey && e.shiftKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+A (전체캡처) - 입력 필드 제외하고 차단
      if (
        !isInput &&
        e.ctrlKey &&
        e.shiftKey &&
        (e.key === "a" || e.key === "A")
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+F (지정사이즈 캡처) - 모든 곳에서 차단
      if (e.ctrlKey && e.shiftKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // PrintScreen 키 - 모든 곳에서 차단
      if (e.key === "PrintScreen") {
        e.preventDefault();
        e.stopPropagation();
        // 클립보드 지우기 시도
        if (navigator.clipboard) {
          navigator.clipboard.writeText("").catch(() => {});
        }
        return false;
      }
      // Win+Shift+S (Windows 스크린샷 도구) - 모든 곳에서 차단
      if (e.shiftKey && e.metaKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // F12 (개발자 도구) - 모든 곳에서 차단
      if (e.key === "F12") {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+I (개발자 도구) - 모든 곳에서 차단
      if (e.ctrlKey && e.shiftKey && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };
    document.addEventListener("keydown", blockKeys, { capture: true });
    document.addEventListener("keyup", blockKeys, { capture: true });

    // 클린업
    return () => {
      document.removeEventListener("contextmenu", preventDefaultExceptInput, {
        capture: true,
      });
      document.removeEventListener("selectstart", preventDefaultExceptInput, {
        capture: true,
      });
      document.removeEventListener("dragstart", preventDefaultExceptInput, {
        capture: true,
      });
      document.removeEventListener("copy", preventDefaultExceptInput, {
        capture: true,
      });
      document.removeEventListener("cut", preventDefaultExceptInput, {
        capture: true,
      });
      document.removeEventListener("mousedown", blockRightClick, {
        capture: true,
      });
      document.removeEventListener("mouseup", blockRightClick, {
        capture: true,
      });
      document.removeEventListener("keydown", blockKeys, { capture: true });
      document.removeEventListener("keyup", blockKeys, { capture: true });
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
      // 추가한 스타일 제거
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    };
  }, []);

  // API 키 변경 시 자동 저장
  const handleApiKeyChange = useCallback(
    (newApiKey: string) => {
      setApiKey(newApiKey);
      if (newApiKey.trim()) {
        saveApiKey(newApiKey, rememberApiKey);
      }
    },
    [rememberApiKey]
  );

  // 실시간 콘텐츠 안전성 검사 - 페르소나와 영상소스 독립적으로 체크
  useEffect(() => {
    const checkContent = () => {
      // 두 입력 모두 체크하되, 둘 중 하나만 있어도 경고 표시
      const personaUnsafe = personaInput.trim() ? detectUnsafeWords(personaInput) : [];
      const videoUnsafe = videoSourceScript.trim() ? detectUnsafeWords(videoSourceScript) : [];
      
      const allUnsafeWords = [...new Set([...personaUnsafe, ...videoUnsafe])];

      if (allUnsafeWords.length > 0) {
        const textToCheck = [personaInput, videoSourceScript].filter(t => t.trim()).join(" ");
        const { replacements } = replaceUnsafeWords(textToCheck);
        setContentWarning({ unsafeWords: allUnsafeWords, replacements });
        setHasContentWarning(true);
        setIsContentWarningAcknowledged(false);
      } else {
        setContentWarning(null);
        setHasContentWarning(false);
        setIsContentWarningAcknowledged(false);
      }
    };

    const debounceTimer = setTimeout(checkContent, 300);
    return () => clearTimeout(debounceTimer);
  }, [personaInput, videoSourceScript]);

  // Remember Me 설정 변경
  const handleRememberMeChange = useCallback(
    (remember: boolean) => {
      setRememberApiKey(remember);
      if (apiKey.trim()) {
        saveApiKey(apiKey, remember);
      }
    },
    [apiKey]
  );

  // API 키 삭제
  const handleClearApiKey = useCallback(() => {
    clearApiKey();
    setApiKey("");
    setRememberApiKey(true);
  }, []);

  // 참조 이미지 업로드 핸들러
  const handleReferenceImageUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // 파일 타입 검증
      if (!file.type.startsWith("image/")) {
        setError("이미지 파일만 업로드할 수 있습니다.");
        return;
      }

      // 파일 크기 검증 (최대 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        setError("이미지 파일 크기는 10MB를 초과할 수 없습니다.");
        return;
      }

      // 허용된 이미지 포맷 검증
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
      ];
      if (!allowedTypes.includes(file.type)) {
        setError("지원되는 이미지 형식: JPG, JPEG, PNG, WEBP");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const base64Data = result.split(",")[1]; // data:image/jpeg;base64, 부분 제거
        setReferenceImage(base64Data);
        setError(null); // 성공 시 에러 초기화
      };
      reader.onerror = () => {
        setError("이미지 파일을 읽는 중 오류가 발생했습니다.");
      };
      reader.readAsDataURL(file);
    },
    []
  );

  // 참조 이미지 삭제 핸들러
  const handleRemoveReferenceImage = useCallback(() => {
    setReferenceImage(null);
  }, []);

  // 카메라 앵글용 이미지 업로드 핸들러
  const handleCameraAngleImageUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // 파일 타입 검증
      if (!file.type.startsWith("image/")) {
        setCameraAngleError("이미지 파일만 업로드할 수 있습니다.");
        return;
      }

      // 파일 크기 검증 (최대 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setCameraAngleError("이미지 파일 크기는 10MB를 초과할 수 없습니다.");
        return;
      }

      // 허용된 이미지 포맷 검증
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
      ];
      if (!allowedTypes.includes(file.type)) {
        setCameraAngleError("지원되는 이미지 형식: JPG, JPEG, PNG, WEBP");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setCameraAngleSourceImage(result); // data URL 전체 저장
        setCameraAngleError(null);
      };
      reader.onerror = () => {
        setCameraAngleError("이미지 파일을 읽는 중 오류가 발생했습니다.");
      };
      reader.readAsDataURL(file);
    },
    []
  );

  // 카메라 앵글 생성 핸들러
  const handleGenerateCameraAngles = useCallback(async () => {
    if (!apiKey.trim()) {
      setCameraAngleError("Google Gemini API 키를 입력해주세요.");
      return;
    }
    if (!cameraAngleSourceImage) {
      setCameraAngleError("변환할 이미지를 업로드해주세요.");
      return;
    }
    if (selectedCameraAngles.length === 0) {
      setCameraAngleError("생성할 앵글을 최소 1개 이상 선택해주세요.");
      return;
    }

    setIsLoadingCameraAngles(true);
    setCameraAngleError(null);
    setCameraAngles([]);
    setCameraAngleProgress("시작 중...");

    try {
      const generatedAngles = await geminiService.generateCameraAngles(
        cameraAngleSourceImage,
        selectedCameraAngles,
        apiKey,
        aspectRatio,
        (message, current, total) => {
          setCameraAngleProgress(`${message} (${current}/${total})`);
        }
      );

      setCameraAngles(generatedAngles);

      // 생성 완료 시 즉시 저장
      console.log('✅ 카메라 앵글 생성 완료 - 즉시 저장 실행');
      setTimeout(() => saveDataToStorage(true), 100);

      const successCount = generatedAngles.filter(
        a => a.image && a.image.trim() !== ""
      ).length;
      const totalSelected = selectedCameraAngles.length;

      if (successCount === 0) {
        setCameraAngleError(
          "모든 카메라 앵글 생성에 실패했습니다. 잠시 후 다시 시도해주세요."
        );
      } else if (successCount < totalSelected) {
        setCameraAngleError(
          `⚠️ ${successCount}/${totalSelected}개 앵글 생성 완료\n\n일부 앵글 생성에 실패했습니다. 다시 시도해주세요.`
        );
      }
    } catch (e) {
      console.error("카메라 앵글 생성 오류:", e);
      let errorMessage = "카메라 앵글 생성 중 오류가 발생했습니다.";

      if (e instanceof Error) {
        if (e.message.includes("❌") || e.message.includes("💡")) {
          errorMessage = e.message;
        } else {
          const message = e.message.toLowerCase();
          if (message.includes("quota") || message.includes("limit") || message.includes("사용량")) {
            errorMessage =
              "❌ API 사용량 한도 초과\n\n💡 해결 방법:\n1. 5-10분 후 재시도\n2. Google Cloud Console에서 할당량 확인";
          } else if (message.includes("network") || message.includes("네트워크")) {
            errorMessage =
              "❌ 네트워크 오류\n\n💡 해결 방법:\n1. 인터넷 연결 확인\n2. 잠시 후 재시도";
          } else {
            errorMessage = `❌ 오류 발생\n\n상세: ${e.message}\n\n💡 잠시 후 재시도해주세요.`;
          }
        }
      }

      setCameraAngleError(errorMessage);
    } finally {
      setIsLoadingCameraAngles(false);
    }
  }, [cameraAngleSourceImage, apiKey, aspectRatio]);

  // 콘텐츠 안전성 검사 및 자동 교체 함수
  const checkAndReplaceContent = useCallback((text: string) => {
    const unsafeWords = detectUnsafeWords(text);
    if (unsafeWords.length > 0) {
      const { replacedText, replacements } = replaceUnsafeWords(text);
      setContentWarning({ unsafeWords, replacements });
      return replacedText;
    }
    setContentWarning(null);
    return text;
  }, []);

  // 안전한 단어로 자동 교체 버튼 핸들러
  const handleAutoReplace = useCallback(() => {
    if (contentWarning) {
      const { replacedText: replacedPersona } =
        replaceUnsafeWords(personaInput);
      const { replacedText: replacedScript } =
        replaceUnsafeWords(videoSourceScript);
      setPersonaInput(replacedPersona);
      setVideoSourceScript(replacedScript);
      setContentWarning(null);
      setHasContentWarning(false);
      setIsContentWarningAcknowledged(true);
    }
  }, [personaInput, videoSourceScript, contentWarning]);

  // 콘텐츠 경고 확인 핸들러
  const handleAcknowledgeWarning = useCallback(() => {
    setIsContentWarningAcknowledged(true);
  }, []);

  const handleGeneratePersonas = useCallback(async () => {
    if (!apiKey.trim()) {
      setPersonaError("Google Gemini API 키를 입력해주세요.");
      return;
    }
    if (!personaInput.trim()) {
      setPersonaError("캐릭터 설명 또는 대본을 입력해주세요.");
      return;
    }

    // 원본 텍스트를 그대로 사용 (사용자가 입력한 대본 유지)
    console.log("🔍 페르소나 생성 시작 - 입력 텍스트:", personaInput);
    const safeInput = personaInput; // 원본 유지

    setIsLoadingCharacters(true);
    setPersonaError(null);
    setCharacters([]);
    setLoadingProgress("API 키 확인 중...");

    try {
      // Step 1: API 키 테스트
      const testResult = await testApiKey(apiKey);

      if (!testResult.success) {
        setPersonaError(`API 키 테스트 실패: ${testResult.message}`);
        setIsLoadingCharacters(false);
        setLoadingProgress("");
        return;
      }

      // Step 2: 캐릭터 생성 (페르소나용 참조 이미지 포함)
      setLoadingProgress("캐릭터 생성 시작...");
      const generatedCharacters = await geminiService.generateCharacters(
        safeInput,
        apiKey,
        imageStyle,
        aspectRatio,
        personaStyle,
        customStyle,
        photoComposition,
        customPrompt,
        characterStyle,
        backgroundStyle,
        customCharacterStyle,
        customBackgroundStyle,
        personaReferenceImage, // 페르소나용 참조 이미지 전달
        (progress) => setLoadingProgress(progress) // 진행 상황 콜백
      );
      if (generatedCharacters.length === 0) {
        setPersonaError(
          "캐릭터 생성에 실패했습니다. 다른 캐릭터 설명으로 다시 시도해보세요."
        );
      } else {
        setCharacters(generatedCharacters);

        // 생성 완료 시 즉시 저장
        console.log('✅ 페르소나 생성 완료 - 즉시 저장 실행');
        setTimeout(() => saveDataToStorage(true), 100);

        // 교체 정보가 있는지 확인
        const hasReplacements = generatedCharacters.some((char) =>
          char.description.includes("⚠️ 알림:")
        );

        if (hasReplacements) {
          // 교체가 있었던 경우 - 성공 메시지 (녹색)
          setPersonaError(
            `✅ ${generatedCharacters.length}개 캐릭터가 성공적으로 생성되었습니다.\n일부 단어가 안전한 표현으로 자동 교체되었습니다. 각 캐릭터 설명을 확인해주세요.`
          );
        }
        // 교체 없이 모두 성공한 경우는 에러 메시지 표시 안 함 (personaError를 null로 유지)
      }
    } catch (e) {
      console.error("캐릭터 생성 오류:", e);
      let errorMessage = "캐릭터 생성 중 오류가 발생했습니다.";

      if (e instanceof Error) {
        // geminiService에서 이미 상세한 에러 메시지를 만들었으면 그대로 사용
        if (e.message.includes("❌") || e.message.includes("💡")) {
          errorMessage = e.message;
        } else {
          const message = e.message.toLowerCase();
          if (
            message.includes("content policy") ||
            message.includes("policy restrictions") ||
            message.includes("정책")
          ) {
            errorMessage =
              "❌ 콘텐츠 정책 위반으로 이미지 생성이 실패했습니다.\n\n💡 해결 방법:\n1. 폭력적, 선정적 표현 제거\n2. 중립적이고 긍정적인 표현으로 변경\n3. 구체적인 신체 묘사 대신 성격/역할 중심으로 작성";
          } else if (message.includes("api") && message.includes("key")) {
            errorMessage =
              "❌ API 키 오류입니다.\n\n💡 해결 방법:\n1. Google AI Studio에서 API 키 확인\n2. API 키를 정확히 복사했는지 확인\n3. API 키가 활성화되어 있는지 확인";
          } else if (
            message.includes("quota") ||
            message.includes("limit") ||
            message.includes("rate") ||
            message.includes("사용량")
          ) {
            errorMessage =
              "❌ API 사용량 한도에 도달했습니다.\n\n💡 해결 방법:\n1. 5-10분 후 다시 시도\n2. 캐릭터 수를 1-3개로 줄이기\n3. Google Cloud Console에서 할당량 확인";
          } else if (message.includes("network") || message.includes("fetch") || message.includes("네트워크")) {
            errorMessage =
              "❌ 네트워크 오류가 발생했습니다.\n\n💡 해결 방법:\n1. 인터넷 연결 상태 확인\n2. 방화벽/보안 프로그램 확인\n3. 다른 네트워크로 변경 후 재시도";
          } else {
            errorMessage = `❌ 오류 발생\n\n상세 내용: ${e.message}\n\n💡 해결 방법:\n1. 입력 내용 확인\n2. API 키 확인\n3. 잠시 후 재시도`;
          }
        }
      } else if (typeof e === "string") {
        errorMessage = e;
      }

      setPersonaError(errorMessage);
    } finally {
      setIsLoadingCharacters(false);
      setLoadingProgress("");
    }
  }, [
    personaInput,
    apiKey,
    imageStyle,
    aspectRatio,
    personaStyle,
    customStyle,
    photoComposition,
    customPrompt,
    personaReferenceImage,
    characterStyle,
    backgroundStyle,
    customCharacterStyle,
    customBackgroundStyle,
  ]);

  const handleRegenerateCharacter = useCallback(
    async (
      characterId: string,
      description: string,
      name: string,
      customPrompt?: string
    ) => {
      if (!apiKey.trim()) {
        setPersonaError("Google Gemini API 키를 입력해주세요.");
        return;
      }
      try {
        // 커스텀 프롬프트가 있으면 description에 추가
        const enhancedDescription = customPrompt
          ? `${description}. Additional style: ${customPrompt}`
          : description;

        const newImage = await geminiService.regenerateCharacterImage(
          enhancedDescription,
          name,
          apiKey,
          imageStyle,
          aspectRatio,
          personaStyle
        );
        setCharacters((prev) =>
          prev.map((char) =>
            char.id === characterId ? { ...char, image: newImage } : char
          )
        );
      } catch (e) {
        console.error("캐릭터 재생성 오류:", e);
        const errorMessage =
          e instanceof Error
            ? `캐릭터 이미지 재생성 실패: ${e.message}`
            : "캐릭터 이미지 재생성에 실패했습니다.";
        setPersonaError(errorMessage);
      }
    },
    [apiKey, imageStyle, aspectRatio, personaStyle]
  );

  const handleGenerateVideoSource = useCallback(async () => {
    if (!apiKey.trim()) {
      setError("Google Gemini API 키를 입력해주세요.");
      return;
    }
    if (!videoSourceScript.trim()) {
      setError("영상 소스 생성을 위한 대본을 입력해주세요.");
      return;
    }

    // 콘텐츠 안전성 검사 및 자동 교체
    console.log("🔍 영상 소스 - 검사 시작:", videoSourceScript);
    const unsafeWords = detectUnsafeWords(videoSourceScript);
    console.log("⚠️ 영상 소스 - 감지된 위험 단어:", unsafeWords);

    let safeScript = videoSourceScript;

    if (unsafeWords.length > 0) {
      const { replacedText, replacements } =
        replaceUnsafeWords(videoSourceScript);
      safeScript = replacedText;

      console.log("✅ 영상 소스 - 교체 완료:", replacements);
      console.log("📝 영상 소스 - 교체 후 텍스트:", safeScript);

      // 사용자에게 교체 내역 알림
      const replacementList = replacements
        .map((r) => `  • "${r.original}" → "${r.replacement}"`)
        .join("\n");

      const alertMessage = `🔄 안전한 이미지 생성을 위해 다음 단어를 자동으로 교체했습니다:\n\n${replacementList}\n\n이제 안전한 텍스트로 영상 소스를 생성합니다.`;

      console.log("🔔 영상 소스 - 알림 표시:", alertMessage);
      alert(alertMessage);

      // 입력 필드도 안전한 텍스트로 업데이트
      setVideoSourceScript(safeScript);
    } else {
      console.log("✅ 영상 소스 - 안전한 단어만 사용되었습니다.");
    }

    // 이미지 개수 제한 - 자동 조정 (함수 중단하지 않음)
    const limitedImageCount = Math.min(imageCount, 20);
    if (imageCount > 20) {
      setImageCount(20);
      // 경고는 표시하지만 생성은 계속 진행
      console.warn("이미지 개수가 20개로 자동 조정되었습니다.");
    }

    setIsLoadingVideoSource(true);
    setError(null);
    setVideoSource([]);
    setLoadingProgress("영상 이미지 생성 준비 중...");

    try {
      // 안전한 스크립트로 생성
      const generatedVideoSource = await geminiService.generateStoryboard(
        safeScript,
        characters,
        limitedImageCount,
        apiKey,
        imageStyle,
        subtitleEnabled,
        referenceImage,
        aspectRatio,
        (progress) => setLoadingProgress(progress) // 진행 상황 콜백
      );

      // 모든 이미지 포함 (실패한 이미지도 빈 카드로 표시)
      setVideoSource(generatedVideoSource);
      
      // 생성 완료 시 즉시 저장
      console.log('✅ 영상 소스 생성 완료 - 즉시 저장 실행');
      setTimeout(() => saveDataToStorage(true), 100);
      
      const successfulImages = generatedVideoSource.filter(
        (item) => item.image && item.image.trim() !== ""
      );
      const failedCount = generatedVideoSource.length - successfulImages.length;

      if (failedCount > 0) {
        // 실패한 장면들의 오류 원인 분석
        const failedScenes = generatedVideoSource.filter(
          (item) => !item.image || item.image.trim() === ""
        );
        
        // 실패한 장면 번호와 설명 추출
        const failedSceneDetails = failedScenes.map((scene, idx) => {
          const sceneNumber = generatedVideoSource.indexOf(scene) + 1;
          return `${sceneNumber}번: ${scene.sceneDescription.substring(0, 50)}...`;
        }).join('\n');
        
        const policyFailures = failedScenes.filter(s => 
          s.sceneDescription.includes("정책") || s.sceneDescription.includes("policy")
        ).length;
        const quotaFailures = failedScenes.filter(s => 
          s.sceneDescription.includes("사용량") || s.sceneDescription.includes("429") || s.sceneDescription.includes("quota")
        ).length;
        const networkFailures = failedScenes.filter(s => 
          s.sceneDescription.includes("네트워크") || s.sceneDescription.includes("network")
        ).length;
        const otherFailures = failedCount - policyFailures - quotaFailures - networkFailures;
        
        let warningMsg = `⚠️ ${successfulImages.length}/${generatedVideoSource.length}개 이미지 생성 완료\n\n`;
        warningMsg += `❌ ${failedCount}개 실패한 장면:\n${failedSceneDetails}\n\n`;
        
        warningMsg += `📋 실패 원인:\n`;
        if (policyFailures > 0) {
          warningMsg += `• 콘텐츠 정책 위반: ${policyFailures}개\n`;
        }
        if (quotaFailures > 0) {
          warningMsg += `• API 속도 제한 (429): ${quotaFailures}개\n`;
        }
        if (networkFailures > 0) {
          warningMsg += `• 네트워크 오류: ${networkFailures}개\n`;
        }
        if (otherFailures > 0) {
          warningMsg += `• 기타 오류: ${otherFailures}개\n`;
        }
        
        warningMsg += `\n💡 해결 방법:\n`;
        if (policyFailures > 0) {
          warningMsg += "• 정책 위반: 해당 장면 설명을 중립적으로 수정\n";
        }
        if (quotaFailures > 0) {
          warningMsg += "• 속도 제한: 1-2분 후 재시도 (유료 사용자도 분당 제한 있음)\n";
        }
        if (networkFailures > 0) {
          warningMsg += "• 네트워크: 인터넷 연결 확인\n";
        }
        
        warningMsg += "\n✨ 실패한 장면은 아래 카드에서 개별 재생성 가능합니다.";
        
        setError(warningMsg);
      } else if (successfulImages.length === 0) {
        setError(
          "❌ 모든 이미지 생성 실패\n\n💡 해결 방법:\n1. API 키 확인\n2. 대본 내용 수정 (정책 위반 표현 제거)\n3. 5-10분 후 재시도\n4. 이미지 개수를 3-5개로 줄이기"
        );
      }
    } catch (e) {
      console.error("영상 소스 생성 오류:", e);
      let errorMessage = "영상 소스 생성 중 오류가 발생했습니다.";

      if (e instanceof Error) {
        const message = e.message.toLowerCase();
        if (message.includes("api") && message.includes("key")) {
          errorMessage =
            "❌ API 키 오류\n\n💡 해결 방법:\n1. Google AI Studio에서 API 키 확인\n2. API 키를 정확히 입력했는지 확인\n3. API 키가 활성화되어 있는지 확인";
        } else if (
          message.includes("quota") ||
          message.includes("limit") ||
          message.includes("rate") ||
          message.includes("사용량")
        ) {
          errorMessage =
            "❌ API 사용량 한도 초과\n\n💡 해결 방법:\n1. 5-10분 후 재시도\n2. 이미지 개수를 3-5개로 줄이기\n3. Google Cloud Console에서 할당량 확인\n4. 필요시 요금제 업그레이드";
        } else if (message.includes("network") || message.includes("fetch") || message.includes("네트워크")) {
          errorMessage =
            "❌ 네트워크 오류\n\n💡 해결 방법:\n1. 인터넷 연결 상태 확인\n2. 방화벽/보안 프로그램 확인\n3. 다른 네트워크로 변경\n4. VPN 사용 시 해제 후 재시도";
        } else if (message.includes("정책") || message.includes("policy")) {
          errorMessage =
            "❌ 콘텐츠 정책 위반\n\n💡 해결 방법:\n1. 대본에서 폭력적/선정적 표현 제거\n2. 중립적이고 긍정적인 내용으로 수정\n3. 구체적인 묘사보다 상황/감정 중심으로 작성";
        } else {
          errorMessage = `❌ 오류 발생\n\n상세 내용: ${e.message}\n\n💡 해결 방법:\n1. 대본 내용 확인\n2. API 키 확인\n3. 잠시 후 재시도\n4. 이미지 개수 줄이기`;
        }
      } else if (typeof e === "string") {
        errorMessage = e;
      }

      setError(errorMessage);
    } finally {
      setIsLoadingVideoSource(false);
      setLoadingProgress("");
    }
  }, [
    videoSourceScript,
    characters,
    imageCount,
    apiKey,
    imageStyle,
    subtitleEnabled,
    referenceImage,
    aspectRatio,
  ]);

  const handleRegenerateVideoSourceImage = useCallback(
    async (videoSourceItemId: string, customPrompt?: string) => {
      if (!apiKey.trim()) {
        setError("Google Gemini API 키를 입력해주세요.");
        return;
      }
      const itemToRegenerate = videoSource.find(
        (item) => item.id === videoSourceItemId
      );
      if (!itemToRegenerate) {
        console.error("재생성할 항목을 찾을 수 없습니다:", videoSourceItemId);
        setError("재생성할 이미지를 찾을 수 없습니다.");
        return;
      }

      console.log(`🔄 영상 소스 재생성 시작 - ID: ${videoSourceItemId}`);
      setError(null); // 이전 에러 초기화

      try {
        // 커스텀 프롬프트가 있으면 장면 설명에 추가
        const enhancedDescription = customPrompt
          ? `${itemToRegenerate.sceneDescription}. Additional style: ${customPrompt}`
          : itemToRegenerate.sceneDescription;

        console.log(`📝 재생성 프롬프트: ${enhancedDescription}`);

        const newImage = await geminiService.regenerateStoryboardImage(
          enhancedDescription,
          characters,
          apiKey,
          imageStyle,
          subtitleEnabled,
          referenceImage,
          aspectRatio
        );

        console.log(`✅ 영상 소스 재생성 성공 - ID: ${videoSourceItemId}`);
        
        setVideoSource((prev) => {
          const updated = prev.map((item) =>
            item.id === videoSourceItemId ? { ...item, image: newImage } : item
          );
          // 재생성 후 즉시 저장
          console.log('💾 재생성된 영상 소스 저장 중...');
          setTimeout(() => saveDataToStorage(true), 100);
          return updated;
        });
      } catch (e: any) {
        console.error("❌ 영상 소스 재생성 오류:", e);
        
        let errorMessage = "영상 소스 이미지 재생성에 실패했습니다.";
        
        if (e.message) {
          // API 에러 메시지 파싱
          if (e.message.includes("INTERNAL") || e.message.includes("500")) {
            errorMessage = `⚠️ Gemini API 서버 오류가 발생했습니다.\n\n잠시 후(10초) 다시 시도해주세요.\n\n오류 상세: ${e.message}`;
          } else if (e.message.includes("RATE_LIMIT") || e.message.includes("429")) {
            errorMessage = `⏳ API 요청 한도를 초과했습니다.\n\n1분 후 다시 시도해주세요.`;
          } else {
            errorMessage = `영상 소스 재생성 실패: ${e.message}`;
          }
        }
        
        setError(errorMessage);
        
        // 실패한 이미지는 상태를 유지
        setVideoSource((prev) =>
          prev.map((item) =>
            item.id === videoSourceItemId
              ? { ...item, sceneDescription: `${item.sceneDescription}\n\n⚠️ 재생성 실패: ${e.message || "알 수 없는 오류"}` }
              : item
          )
        );
      }
    },
    [
      videoSource,
      characters,
      apiKey,
      imageStyle,
      subtitleEnabled,
      referenceImage,
      aspectRatio,
      saveDataToStorage,
    ]
  );

  // 모든 작업 데이터 초기화
  const handleResetAll = useCallback(() => {
    const confirmReset = window.confirm(
      "⚠️ 모든 작업 데이터가 삭제됩니다.\n\n생성된 페르소나, 영상 소스, 카메라 앵글, 입력 내용이 모두 초기화됩니다.\n\n정말 초기화하시겠습니까?"
    );

    if (confirmReset) {
      // 상태 초기화
      setCharacters([]);
      setVideoSource([]);
      setPersonaInput("");
      setVideoSourceScript("");
      setPersonaReferenceImage(null);
      setReferenceImage(null);
      setImageStyle("realistic");
      setPersonaStyle("?? ???");
      setCustomCharacterStyle("");
      setCustomBackgroundStyle("");
      setCustomStyle("");
      setPhotoComposition("??");
      setSelectedCameraAngles([
        "Front View",
        "Right Side View",
        "Left Side View",
        "Back View",
        "Full Body",
        "Close-up Face",
      ]);
      setCharacterStyle("실사 극대화");
      setBackgroundStyle("모던");
      setAspectRatio("16:9");
      setImageCount(5);
      setSubtitleEnabled(false);
      setCustomPrompt("");
      setError(null);
      setPersonaError(null);
      setContentWarning(null);
      setIsContentWarningAcknowledged(false);
      setHasContentWarning(false);
      // 카메라 앵글 초기화 추가
      setCameraAngleSourceImage(null);
      setCameraAngles([]);
      setCameraAngleError(null);
      setCameraAngleProgress("");

      // localStorage + sessionStorage 데이터 완전히 삭제
      localStorage.removeItem("youtube_image_work_data");
      sessionStorage.removeItem("youtube_image_work_data");
      console.log("모든 작업 데이터가 초기화되었습니다. (localStorage + sessionStorage)");

      // 성공 알림
      window.alert("✅ 초기화 완료!\n\n새로운 작업을 시작할 수 있습니다.");
    }
  }, []);

  // 이미지를 새창으로 열기
  const openImageInNewWindow = (imageData: string, title: string = "이미지 보기") => {
    const imageWindow = window.open(
      "",
      "imageViewer",
      "width=800,height=600,resizable=yes,scrollbars=yes"
    );
    
    if (imageWindow) {
      imageWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <title>${title}</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              background: #1a1a1a;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .container {
              width: 100%;
              height: 100vh;
              display: flex;
              flex-direction: column;
            }
            .toolbar {
              background: #2a2a2a;
              padding: 10px 20px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #444;
            }
            .toolbar h2 {
              color: #fff;
              margin: 0;
              font-size: 1.2rem;
            }
            .toolbar button {
              background: #667eea;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 6px;
              cursor: pointer;
              font-weight: 600;
              transition: all 0.2s;
            }
            .toolbar button:hover {
              background: #5568d3;
              transform: scale(1.05);
            }
            .image-container {
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
              overflow: auto;
            }
            img {
              max-width: 100%;
              max-height: 100%;
              object-fit: contain;
              border-radius: 8px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="toolbar">
              <h2>${title}</h2>
              <button onclick="window.close()">✕ 닫기</button>
            </div>
            <div class="image-container">
              <img src="${imageData}" alt="${title}" />
            </div>
          </div>
        </body>
        </html>
      `);
    }
  };

  const handleDownloadAllImages = useCallback(async () => {
    if (videoSource.length === 0) return;

    setIsDownloading(true);
    setError(null);
    
    let successCount = 0;
    let cancelCount = 0;
    
    try {
      // 각 이미지를 순차적으로 다운로드
      for (let index = 0; index < videoSource.length; index++) {
        const item = videoSource[index];
        const safeDescription = item.sceneDescription
          .replace(/[^a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣]/g, "_")
          .substring(0, 30);
        const fileName = `scene_${index + 1}_${safeDescription}.jpg`;
        
        try {
          // Base64를 Blob으로 변환
          const base64Response = await fetch(`data:image/jpeg;base64,${item.image}`);
          const blob = await base64Response.blob();
          
          // File System Access API 지원 확인
          if ('showSaveFilePicker' in window) {
            try {
              const handle = await (window as any).showSaveFilePicker({
                suggestedName: fileName,
                types: [
                  {
                    description: '이미지 파일',
                    accept: {
                      'image/jpeg': ['.jpg', '.jpeg'],
                    },
                  },
                ],
              });
              
              const writable = await handle.createWritable();
              await writable.write(blob);
              await writable.close();
              successCount++;
            } catch (err: any) {
              if (err.name === 'AbortError') {
                // 사용자가 이 파일 저장을 취소함
                cancelCount++;
                console.log(`[${index + 1}/${videoSource.length}] 사용자가 저장을 취소했습니다.`);
              } else {
                throw err;
              }
            }
          } else {
            // 폴백: 기존 다운로드 방식
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            successCount++;
            
            // 자동 다운로드 시 약간의 딜레이
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        } catch (err) {
          console.error(`[개발자용] 이미지 ${index + 1} 다운로드 오류:`, err);
          throw err;
        }
      }
      
      // 다운로드 완료 메시지
      if (successCount > 0) {
        setError(`✅ ${successCount}개의 이미지가 저장되었습니다!` + 
                (cancelCount > 0 ? ` (${cancelCount}개 취소됨)` : ''));
      } else if (cancelCount > 0) {
        setError(`모든 다운로드가 취소되었습니다.`);
      }
    } catch (e) {
      console.error("[개발자용] 이미지 다운로드 오류:", e);
      
      // 사용자용 오류 메시지
      let userMessage = "파일 다운로드에 실패했습니다. 다시 시도해 주세요.";
      
      if (e instanceof Error) {
        console.error(`[개발자용] 오류 상세: ${e.name} - ${e.message}`);
        
        if (e.name === 'NotAllowedError') {
          userMessage = "파일 저장 권한이 거부되었습니다. 브라우저 설정을 확인해 주세요.";
        } else if (e.name === 'SecurityError') {
          userMessage = "보안 문제로 파일을 저장할 수 없습니다. 브라우저를 업데이트하거나 다른 브라우저를 사용해 주세요.";
        }
      }
      
      setError(userMessage);
    } finally {
      setIsDownloading(false);
    }
  }, [videoSource]);

  // 라우팅 처리
  if (currentView === "api-guide") {
    return (
      <>
        <MetaTags
          title="API 발급 가이드 - 유튜브 롱폼 이미지 생성기"
          description="Google Gemini API 키 발급 방법을 단계별로 안내합니다. 무료로 유튜브 콘텐츠용 AI 이미지를 생성하세요."
          url="https://youtube.money-hotissue.com/image/api-guide"
          image="/api-guide-preview.png"
          type="article"
        />
        <ApiKeyGuide
          onBack={() => navigateToView("main")}
        />
      </>
    );
  }

  if (currentView === "user-guide") {
    return (
      <>
        <MetaTags
          title="유튜브 이미지 생성기 사용법 가이드 - AI로 콘텐츠 제작하기"
          description="AI를 활용하여 유튜브 페르소나와 영상 소스를 생성하는 방법을 상세히 알려드립니다. 단계별 가이드로 쉽게 따라하세요."
          url="https://youtube.money-hotissue.com/image/user-guide"
          image="/user-guide-preview.png"
          type="article"
        />
        <UserGuide
          onBack={() => navigateToView("main")}
          onNavigate={(view) => {
            if (view === "api-guide") {
              navigateToView("api-guide");
            }
          }}
        />
      </>
    );
  }

  return (
    <>
      <AdBlockDetector />
      <MetaTags
        title="유튜브 롱폼 이미지 생성기 - AI로 캐릭터와 스토리보드 만들기"
        description="Google Gemini AI를 활용해 유튜브 콘텐츠용 페르소나와 영상 소스를 쉽고 빠르게 생성하세요. 다양한 비율(9:16, 16:9, 1:1) 지원."
        url="https://youtube.money-hotissue.com/image"
        image="/og-image.png"
        type="website"
      />
      <SideFloatingAd side="left" />
      <SideFloatingAd side="right" />
      <div
        className="min-h-screen bg-gray-900 text-white font-sans p-4 sm:p-6 lg:p-8"
        style={{ paddingBottom: "120px" }}
      >
        <div className="max-w-4xl mx-auto">
          <header className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
              유튜브 롱폼 이미지 생성기
            </h1>
            <p className="mt-2 text-lg text-gray-400">
              스크립트를 입력하고 일관된 캐릭터와 영상 소스 이미지를 생성하세요!
            </p>

            {/* 데이터 복원 안내 (복원된 데이터가 있을 때만 표시) */}
            {(characters.length > 0 || videoSource.length > 0 || cameraAngles.length > 0) && (
              <div className="mt-4 bg-green-900/20 border border-green-500/50 rounded-lg p-3 max-w-2xl mx-auto">
                <p className="text-green-300 text-sm flex items-center justify-center">
                  <span className="mr-2">💾</span>
                  이전 작업이 복원되었습니다:
                  {characters.length > 0 && ` 페르소나 ${characters.length}개`}
                  {videoSource.length > 0 && ` | 영상소스 ${videoSource.length}개`}
                  {cameraAngles.length > 0 && ` | 카메라앵글 ${cameraAngles.length}개`}
                </p>
              </div>
            )}

            {/* 네비게이션 링크 */}
            <div className="flex justify-center mt-4 space-x-4">
              <button
                onClick={() => navigateToView("api-guide")}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
              >
                📚 API 키 발급 가이드
              </button>
              <button
                onClick={() => navigateToView("user-guide")}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors"
              >
                📖 사용법 가이드
              </button>
            </div>
          </header>

          <main className="space-y-6">
            <section className="bg-gray-800 p-6 rounded-xl shadow-2xl border-2 border-blue-500">
              <h2 className="text-2xl font-bold mb-4 text-blue-400 flex items-center">
                <span className="mr-2">1️⃣</span>
                API 키 입력
              </h2>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Google Gemini API 키를 입력하세요..."
                    className="flex-1 p-4 bg-gray-900 border-2 border-blue-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  />
                  <button
                    onClick={async () => {
                      handleApiKeyChange(apiKey);
                      if (apiKey.trim()) {
                        try {
                          const testResult = await testApiKey(apiKey);
                          if (testResult.success) {
                            alert('✅ API 키가 정상적으로 등록되었습니다!\n\n' + testResult.message);
                          } else {
                            alert('❌ API 키 테스트 실패\n\n' + testResult.message);
                          }
                        } catch (error) {
                          alert('❌ API 키 확인 중 오류가 발생했습니다.');
                        }
                      }
                    }}
                    disabled={!apiKey.trim()}
                    className={`px-6 py-4 rounded-lg text-sm font-bold transition-colors ${
                      apiKey.trim()
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : "bg-gray-600 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    ✅ 확인
                  </button>
                  <button
                    onClick={() => navigateToView("api-guide")}
                    className="px-4 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors flex items-center"
                  >
                    📚 발급 방법
                  </button>
                </div>

                {/* 통합 안내 섹션 */}
                <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4 space-y-3">
                  {/* API 키 기억하기 */}
                  <div className="flex items-center justify-between pb-3 border-b border-blue-600/30">
                    <label className="flex items-center text-gray-300">
                      <input
                        type="checkbox"
                        checked={rememberApiKey}
                        onChange={(e) =>
                          handleRememberMeChange(e.target.checked)
                        }
                        className="mr-2 w-4 h-4 text-blue-600 bg-gray-900 border-gray-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm">
                        <strong className="text-blue-400">
                          ✅ API 키 기억하기
                        </strong>
                        <span className="text-gray-400 text-xs ml-1 block">
                          {rememberApiKey
                            ? "브라우저에 암호화 저장됨"
                            : "탭 닫으면 삭제됨"}
                        </span>
                      </span>
                    </label>

                    {apiKey && (
                      <button
                        onClick={handleClearApiKey}
                        className="text-red-400 hover:text-red-300 text-sm underline"
                      >
                        저장된 키 삭제
                      </button>
                    )}
                  </div>

                  {/* 보안 안내 */}
                  <div className="flex items-start space-x-2 pb-3 border-b border-blue-600/30">
                    <span className="text-amber-500 text-lg flex-shrink-0">
                      🔒
                    </span>
                    <div className="text-sm space-y-1">
                      <p className="text-amber-400 font-semibold">보안 안내</p>
                      <p className="text-gray-300 text-xs leading-relaxed">
                        • API 키는{" "}
                        {rememberApiKey
                          ? "암호화되어 브라우저에만"
                          : "현재 세션에만"}{" "}
                        저장되며, 외부 서버로 전송되지 않습니다
                        <br />
                        • 공용 컴퓨터를 사용하는 경우 "기억하기"를 체크하지
                        마세요
                        <br />• API 키가 유출된 경우 즉시 Google AI Studio에서
                        재발급 받으세요
                      </p>
                    </div>
                  </div>

                  {/* API 비용 안내 */}
                  <div className="flex items-start space-x-2">
                    <span className="text-blue-500 text-lg flex-shrink-0">
                      💰
                    </span>
                    <div className="text-sm space-y-1">
                      <p className="text-blue-400 font-semibold">
                        API 비용 안내
                      </p>
                      <p className="text-gray-300 text-xs leading-relaxed">
                        • Gemini API 무료 등급에서 이미지 생성 기능 제공
                        <br />•{" "}
                        <span className="text-blue-400 font-semibold">
                          분당 15회 요청
                        </span>{" "}
                        제한만 있고, 결제나 비용 발생 없음
                        <br />• 분당 요청 수만 지키면{" "}
                        <span className="text-blue-400 font-semibold">
                          무료
                        </span>
                        로 사용 가능
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 광고 1: API 키와 페르소나 생성 사이 */}
            <AdBanner />

            <section className="bg-gray-800 p-6 rounded-xl shadow-2xl border-2 border-purple-500">
              <h2 className="text-2xl font-bold mb-4 text-purple-400 flex items-center">
                <span className="mr-2">2️⃣</span>
                페르소나 생성
              </h2>
              <div className="mb-4">
                <p className="text-gray-400 text-sm mb-3">
                  구체적인 인물 묘사를 입력하거나, 대본을 넣으면 등장인물들을
                  자동으로 분석하여 생성합니다.
                </p>
                <div className="bg-purple-900/20 border border-purple-500/50 rounded-lg p-4 mb-4">
                  <p className="text-purple-200 text-sm mb-2">
                    <strong>입력 예시:</strong>
                  </p>
                  <ul className="text-purple-300 text-sm space-y-1 ml-4">
                    <li>
                      • <strong>인물 묘사:</strong> "20대 중반 여성, 긴 흑발,
                      밝은 미소, 캐주얼한 옷차림"
                    </li>
                    <li>
                      • <strong>대본 입력:</strong> 전체 스토리 대본을 넣으면
                      등장인물 자동 추출
                    </li>
                  </ul>
                </div>
              </div>
              <textarea
                value={personaInput}
                onChange={(e) => setPersonaInput(e.target.value)}
                placeholder="인물 묘사나 대본을 입력하세요..."
                className="w-full h-48 p-4 bg-gray-900 border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-200 resize-y mb-6"
              />

              {/* 이미지 스타일 선택 */}
              <div className="mb-6 bg-purple-900/20 border border-purple-500/50 rounded-lg p-6">
                <h3 className="text-purple-300 font-medium mb-6 flex items-center">
                  <span className="mr-2">🎨</span>
                  이미지 스타일 선택
                </h3>

                {/* 인물 스타일 */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-purple-200 font-medium flex items-center text-sm">
                      <span className="mr-2">👤</span>
                      인물 스타일
                    </h4>
                    <button
                      onClick={() => setCharacterStyle("custom")}
                      className={`py-1.5 px-4 rounded-lg font-medium text-xs transition-all duration-200 ${
                        characterStyle === "custom"
                          ? "bg-purple-600 text-white shadow-lg scale-105"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      직접 입력
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {(
                      [
                        "실사 극대화",
                        "애니메이션",
                        "동물",
                        "웹툰",
                      ] as CharacterStyle[]
                    ).map((style) => {
                      const styleDescriptions: Record<CharacterStyle, string> =
                        {
                          "실사 극대화":
                            "📸 초현실적이고 사진 같은 퀄리티의 실사 인물",
                          애니메이션: "🎨 밝고 화려한 애니메이션 스타일 캐릭터",
                          동물: "🐾 귀여운 동물 캐릭터로 변환",
                          웹툰: "📖 깨끗한 선과 표현력 풍부한 한국 웹툰 스타일",
                          custom: "",
                        };

                      return (
                        <div key={style} className="relative group">
                          <button
                            onClick={() => setCharacterStyle(style)}
                            onMouseEnter={() =>
                              setHoveredStyle(`character-${style}`)
                            }
                            onMouseLeave={() => setHoveredStyle(null)}
                            className={`w-full py-2 px-3 rounded-lg font-medium text-sm transition-all duration-200 ${
                              characterStyle === style
                                ? "bg-purple-600 text-white shadow-lg scale-105"
                                : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:scale-105"
                            }`}
                          >
                            {style}
                          </button>
                          {hoveredStyle === `character-${style}` && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
                              <div className="bg-gray-900 rounded-lg shadow-2xl border border-purple-500/50 overflow-hidden" style={{ minWidth: '500px' }}>
                                <div className="p-3">
                                  <div className="text-purple-200 font-medium text-sm mb-2 text-center">
                                    {style} 미리보기
                                  </div>
                                  <img
                                    src={`/${style}.png`}
                                    alt={`${style} 스타일 미리보기`}
                                    className="w-full h-auto object-contain rounded"
                                    style={{ maxHeight: '400px', minHeight: '300px' }}
                                    onError={(e) => {
                                      const target =
                                        e.target as HTMLImageElement;
                                      target.style.display = "none";
                                      const parent = target.parentElement;
                                      if (parent) {
                                        const fallback =
                                          document.createElement("div");
                                        fallback.className =
                                          "w-full bg-gray-800 rounded flex items-center justify-center text-purple-300 text-sm text-center p-4";
                                        fallback.style.minHeight = "300px";
                                        fallback.textContent =
                                          styleDescriptions[style];
                                        parent.appendChild(fallback);
                                      }
                                    }}
                                  />
                                  <div className="text-gray-300 text-xs mt-2 text-center px-2">
                                    {styleDescriptions[style]}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {characterStyle === "custom" && (
                    <input
                      type="text"
                      value={customCharacterStyle}
                      onChange={(e) => setCustomCharacterStyle(e.target.value)}
                      placeholder="원하는 인물 스타일을 입력하세요 (예: 르네상스, 빅토리아 시대 등)"
                      className="w-full p-3 bg-gray-900 border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors mt-3"
                    />
                  )}
                </div>

                {/* 배경/분위기 스타일 */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-purple-200 font-medium flex items-center text-sm">
                      <span className="mr-2">🌆</span>
                      배경/분위기 스타일
                    </h4>
                    <button
                      onClick={() => setBackgroundStyle("custom")}
                      className={`py-1.5 px-4 rounded-lg font-medium text-xs transition-all duration-200 ${
                        backgroundStyle === "custom"
                          ? "bg-purple-600 text-white shadow-lg scale-105"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      직접 입력
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
                    {(
                      [
                        "감성 멜로",
                        "서부극",
                        "공포 스릴러",
                        "사이버펑크",
                        "판타지",
                        "미니멀",
                        "빈티지",
                        "모던",
                        "1980년대",
                        "2000년대",
                        "먹방",
                        "귀여움",
                        "AI",
                        "괴이함",
                        "창의적인",
                        "조선시대",
                      ] as BackgroundStyle[]
                    ).map((style) => {
                      const styleDescriptions: Record<BackgroundStyle, string> =
                        {
                          "감성 멜로": "🌸 로맨틱하고 감성적인 따뜻한 분위기",
                          서부극: "🤠 거친 사막과 카우보이 배경",
                          "공포 스릴러": "🎭 미스터리하고 긴장감 있는 분위기",
                          사이버펑크: "🌃 네온사인 가득한 미래 도시",
                          판타지: "🧙‍♂️ 마법적이고 신비로운 중세 배경",
                          미니멀: "⚪ 깔끔하고 단순한 중성톤 배경",
                          빈티지: "📷 클래식하고 향수를 자아내는 배경",
                          모던: "🏢 현대적이고 세련된 도시 배경",
                          "1980년대": "💫 80년대 레트로 패션과 분위기",
                          "2000년대": "📱 2000년대 초반 감성과 스타일",
                          먹방: "🍽️ 맛있는 음식이 가득한 먹방 분위기",
                          귀여움: "🎀 귀엽고 사랑스러운 파스텔 감성",
                          AI: "🤖 미래지향적인 하이테크 AI 분위기",
                          괴이함: "👁️ 독특하고 초현실적인 기묘한 분위기",
                          창의적인: "🎨 상상력 넘치는 독창적인 예술 분위기",
                          조선시대: "🏯 한옥과 전통 가옥, 따뜻하고 감성적인 조선 분위기",
                          custom: "",
                        };

                      return (
                        <div key={style} className="relative group">
                          <button
                            onClick={() => setBackgroundStyle(style)}
                            onMouseEnter={() =>
                              setHoveredStyle(`background-${style}`)
                            }
                            onMouseLeave={() => setHoveredStyle(null)}
                            className={`w-full py-2 px-3 rounded-lg font-medium text-sm transition-all duration-200 ${
                              backgroundStyle === style
                                ? "bg-purple-600 text-white shadow-lg scale-105"
                                : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:scale-105"
                            }`}
                          >
                            {style}
                          </button>
                          {hoveredStyle === `background-${style}` && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
                              <div className="bg-gray-900 rounded-lg shadow-2xl border border-purple-500/50 overflow-hidden" style={{ minWidth: '500px' }}>
                                <div className="p-3">
                                  <div className="text-purple-200 font-medium text-sm mb-2 text-center">
                                    {style} 미리보기
                                  </div>
                                  <img
                                    src={`/${
                                      style === "AI" ? "ai" : style
                                    }.png`}
                                    alt={`${style} 스타일 미리보기`}
                                    className="w-full h-auto object-contain rounded"
                                    style={{ maxHeight: '400px', minHeight: '300px' }}
                                    onError={(e) => {
                                      const target =
                                        e.target as HTMLImageElement;
                                      target.style.display = "none";
                                      const parent = target.parentElement;
                                      if (parent) {
                                        const fallback =
                                          document.createElement("div");
                                        fallback.className =
                                          "w-full bg-gray-800 rounded flex items-center justify-center text-purple-300 text-sm text-center p-4";
                                        fallback.style.minHeight = "300px";
                                        fallback.textContent =
                                          styleDescriptions[style];
                                        parent.appendChild(fallback);
                                      }
                                    }}
                                  />
                                  <div className="text-gray-300 text-xs mt-2 text-center px-2">
                                    {styleDescriptions[style]}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {backgroundStyle === "custom" && (
                    <input
                      type="text"
                      value={customBackgroundStyle}
                      onChange={(e) => setCustomBackgroundStyle(e.target.value)}
                      placeholder="원하는 배경/분위기를 입력하세요 (예: 우주 정거장, 열대 해변 등)"
                      className="w-full p-3 bg-gray-900 border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors mt-3"
                    />
                  )}
                </div>
              </div>

              {/* 사진 설정 (구도 및 비율) */}
              <div className="mb-6 bg-purple-900/20 border border-purple-500/50 rounded-lg p-6">
                <h3 className="text-purple-300 font-medium mb-4 flex items-center">
                  <span className="mr-2">📐</span>
                  사진 설정
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 왼쪽: 사진 구도 선택 */}
                  <div>
                    <label className="block text-purple-200 text-sm font-medium mb-2">
                      사진 구도
                    </label>
                    <select
                      value={photoComposition}
                      onChange={(e) =>
                        setPhotoComposition(e.target.value as PhotoComposition)
                      }
                      className="w-full p-3 bg-gray-900 border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors text-white"
                    >
                      <option value="정면">정면 (기본)</option>
                      <option value="측면">측면</option>
                      <option value="반측면">반측면</option>
                      <option value="위에서">위에서</option>
                      <option value="아래에서">아래에서</option>
                      <option value="전신">전신</option>
                      <option value="상반신">상반신</option>
                      <option value="클로즈업">클로즈업</option>
                    </select>
                  </div>

                  {/* 오른쪽: 이미지 비율 선택 */}
                  <div>
                    <label className="block text-purple-200 text-sm font-medium mb-2">
                      이미지 비율
                    </label>
                    <select
                      value={aspectRatio}
                      onChange={(e) =>
                        setAspectRatio(e.target.value as AspectRatio)
                      }
                      className="w-full p-3 bg-gray-900 border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors text-white"
                    >
                      <option value="9:16">📱 9:16 - 모바일 세로</option>
                      <option value="16:9">🖥️ 16:9 - 데스크톱 가로</option>
                      <option value="1:1">⬜ 1:1 - 정사각형</option>
                    </select>
                  </div>
                </div>

                <div className="text-xs text-gray-400 mt-3">
                  💡 사진 구도와 이미지 비율을 조합하여 원하는 스타일의 이미지를
                  만드세요.
                </div>
              </div>

              {/* 스타일 참조 이미지 업로드 (선택사항) */}
              <div className="mb-6 bg-purple-900/20 border border-purple-500/50 rounded-lg p-6">
                <h3 className="text-purple-300 font-medium mb-4 flex items-center">
                  <span className="mr-2">🖼️</span>
                  스타일 참조 이미지 (선택사항)
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  원하는 스타일의 사진을 업로드하면 해당 스타일을 참고하여
                  페르소나를 생성합니다.
                </p>

                {!personaReferenceImage ? (
                  <label className="block w-full cursor-pointer">
                    <div className="border-2 border-dashed border-purple-500 rounded-lg p-8 text-center hover:border-purple-400 hover:bg-purple-900/10 transition-all">
                      <div className="text-purple-300 text-4xl mb-3">📷</div>
                      <p className="text-purple-200 font-medium mb-1">
                        참조 이미지 업로드
                      </p>
                      <p className="text-gray-400 text-sm">
                        클릭하여 이미지 선택 (JPG, PNG)
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const base64 = (
                                event.target?.result as string
                              ).split(",")[1];
                              setPersonaReferenceImage(base64);
                            };
                            reader.readAsDataURL(file);
                          } catch (error) {
                            console.error("이미지 로드 실패:", error);
                            setError("이미지를 불러오는데 실패했습니다.");
                          }
                        }
                      }}
                    />
                  </label>
                ) : (
                  <div className="relative">
                    <img
                      src={`data:image/jpeg;base64,${personaReferenceImage}`}
                      alt="참조 이미지"
                      className="w-full max-h-64 object-contain rounded-lg border-2 border-purple-500"
                    />
                    <button
                      onClick={() => setPersonaReferenceImage(null)}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                    >
                      ✕ 삭제
                    </button>
                    <p className="text-green-400 text-sm mt-2 flex items-center">
                      <span className="mr-2">✅</span>
                      참조 이미지가 업로드되었습니다
                    </p>
                  </div>
                )}
              </div>

              {/* 커스텀 프롬프트 (선택사항) */}
              <div className="mb-6 bg-purple-900/20 border border-purple-500/50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-purple-300 font-medium flex items-center">
                    <span className="mr-2">⚡</span>
                    커스텀 이미지 프롬프트 (선택사항)
                  </h3>
                  <button
                    onClick={() => {
                      window.open("https://gemini.google.com/share/56de66e939ff", "_blank", "noopener,noreferrer");
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold rounded-lg text-sm transition-all duration-200 transform hover:scale-105 flex items-center"
                  >
                    <span className="mr-2">🎯</span>
                    내가 원하는 이미지 200% 뽑는 노하우
                  </button>
                </div>

                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="고급 사용자용: AI에게 전달할 구체적인 이미지 프롬프트를 직접 입력하세요 (영어 권장)"
                  className="w-full h-24 p-3 bg-gray-900 border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors resize-y"
                />
                <p className="text-gray-400 text-xs mt-2">
                  💡 이 필드는 고급 사용자를 위한 기능입니다. 비워두면 자동으로
                  최적화된 프롬프트가 생성됩니다.
                </p>
              </div>

              {/* 콘텐츠 정책 위반 경고 */}
              {contentWarning && !isContentWarningAcknowledged && (
                <div className="mt-4 bg-orange-900/50 border border-orange-500 text-orange-300 p-4 rounded-lg">
                  <div className="flex items-start">
                    <span className="text-orange-400 text-xl mr-3">⚠️</span>
                    <div className="flex-1">
                      <p className="font-medium mb-2">
                        콘텐츠 정책 위반 가능성이 있는 단어가 감지되었습니다
                      </p>
                      <div className="mb-3">
                        <p className="text-sm text-orange-200 mb-2">
                          감지된 단어:
                        </p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {contentWarning.unsafeWords.map((word, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-orange-800/50 rounded text-sm"
                            >
                              "{word}"
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={handleAutoReplace}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center"
                        >
                          🔄 안전한 단어로 자동 교체
                        </button>
                        <button
                          onClick={handleAcknowledgeWarning}
                          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          무시하고 계속
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleGeneratePersonas}
                disabled={
                  isLoadingCharacters ||
                  !personaInput.trim() ||
                  !apiKey.trim() ||
                  (hasContentWarning && !isContentWarningAcknowledged)
                }
                className="mt-4 w-full sm:w-auto px-6 py-3 bg-purple-600 font-semibold rounded-lg hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
              >
                {isLoadingCharacters ? (
                  <>
                    <Spinner size="sm" />{" "}
                    <span className="ml-2">페르소나 생성 중...</span>
                  </>
                ) : (
                  "페르소나 생성"
                )}
              </button>
            </section>

            {/* 페르소나 생성 관련 오류/성공 메시지 표시 */}
            {personaError && (
              <div
                className={
                  personaError.startsWith("✅")
                    ? "bg-green-900/50 border border-green-500 text-green-300 p-4 rounded-lg"
                    : "bg-red-900/50 border border-red-500 text-red-300 p-4 rounded-lg"
                }
              >
                <div className="flex items-start">
                  <span
                    className={
                      personaError.startsWith("✅")
                        ? "text-green-400 text-xl mr-3"
                        : "text-red-400 text-xl mr-3"
                    }
                  >
                    {personaError.startsWith("✅") ? "✅" : "⚠️"}
                  </span>
                  <div className="flex-1">
                    <pre className="font-medium mb-2 whitespace-pre-wrap text-sm leading-relaxed">{personaError}</pre>
                    <button
                      onClick={() => setPersonaError(null)}
                      className={
                        personaError.startsWith("✅")
                          ? "mt-3 text-green-400 hover:text-green-300 text-sm underline"
                          : "mt-3 text-red-400 hover:text-red-300 text-sm underline"
                      }
                    >
                      오류 메시지 닫기
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isLoadingCharacters && (
              <div className="text-center p-8">
                <Spinner size="lg" />
                <p className="mt-4 text-purple-300 text-lg font-semibold">
                  등장인물을 분석하고 이미지를 생성하고 있습니다...
                </p>
                {loadingProgress && (
                  <div className="mt-4 bg-purple-900/30 border border-purple-500/50 rounded-lg p-4 max-w-md mx-auto">
                    <p className="text-purple-300 font-bold text-lg animate-pulse">
                      📋 {loadingProgress}
                    </p>
                  </div>
                )}
                <p className="mt-4 text-gray-400 text-sm">
                  ⏳ API 과부하 방지를 위해 캐릭터 간 3-4초 대기 시간이 있습니다.
                </p>
                <p className="mt-2 text-gray-500 text-xs">
                  잠시만 기다려 주세요. 고품질 이미지를 생성하는 중입니다.
                </p>
              </div>
            )}

            {characters.length > 0 && (
              <section>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-purple-300">
                    생성된 페르소나 ({characters.length}개)
                  </h2>
                  <button
                    onClick={async () => {
                      try {
                        let successCount = 0;
                        let cancelCount = 0;
                        
                        for (let index = 0; index < characters.length; index++) {
                          const char = characters[index];
                          const safeCharName = char.name.replace(/[^a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣]/g, '_');
                          const fileName = `${index + 1}_${safeCharName}.jpg`;
                          
                          try {
                            const base64Response = await fetch(`data:image/jpeg;base64,${char.image}`);
                            const blob = await base64Response.blob();
                            
                            if ('showSaveFilePicker' in window) {
                              try {
                                const handle = await (window as any).showSaveFilePicker({
                                  suggestedName: fileName,
                                  types: [
                                    {
                                      description: '이미지 파일',
                                      accept: {
                                        'image/jpeg': ['.jpg', '.jpeg'],
                                      },
                                    },
                                  ],
                                });
                                
                                const writable = await handle.createWritable();
                                await writable.write(blob);
                                await writable.close();
                                successCount++;
                              } catch (err: any) {
                                if (err.name === 'AbortError') {
                                  cancelCount++;
                                  console.log(`[${index + 1}/${characters.length}] 사용자가 저장을 취소했습니다.`);
                                } else {
                                  throw err;
                                }
                              }
                            } else {
                              const link = document.createElement('a');
                              link.href = URL.createObjectURL(blob);
                              link.download = fileName;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              URL.revokeObjectURL(link.href);
                              successCount++;
                              await new Promise(resolve => setTimeout(resolve, 300));
                            }
                          } catch (err) {
                            console.error(`[개발자용] 페르소나 ${index + 1} 다운로드 오류:`, err);
                            throw err;
                          }
                        }
                        
                        if (successCount > 0) {
                          setPersonaError(`✅ ${successCount}개의 페르소나가 저장되었습니다!` + 
                                  (cancelCount > 0 ? ` (${cancelCount}개 취소됨)` : ''));
                        } else if (cancelCount > 0) {
                          setPersonaError(`모든 다운로드가 취소되었습니다.`);
                        }
                      } catch (error) {
                        console.error("[개발자용] 페르소나 다운로드 오류:", error);
                        
                        let userMessage = "페르소나 다운로드에 실패했습니다. 다시 시도해 주세요.";
                        
                        if (error instanceof Error) {
                          console.error(`[개발자용] 오류 상세: ${error.name} - ${error.message}`);
                          
                          if (error.name === 'NotAllowedError') {
                            userMessage = "파일 저장 권한이 거부되었습니다. 브라우저 설정을 확인해 주세요.";
                          } else if (error.name === 'SecurityError') {
                            userMessage = "보안 문제로 파일을 저장할 수 없습니다. 브라우저를 업데이트하거나 다른 브라우저를 사용해 주세요.";
                          }
                        }
                        
                        setPersonaError(userMessage);
                      }
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold"
                  >
                    📥 모두 다운로드 ({characters.length}개)
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {characters.map((char) => (
                    <CharacterCard
                      key={char.id}
                      character={char}
                      onRegenerate={handleRegenerateCharacter}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 광고 2: 페르소나 생성과 영상 소스 생성 사이 */}
            <AdBanner />

            {/* 3단계는 항상 표시 */}
            <section className="bg-gray-800 p-6 rounded-xl shadow-2xl border-2 border-green-500">
              <h2 className="text-2xl font-bold mb-4 text-green-400 flex items-center">
                <span className="mr-2">3️⃣</span>
                영상 소스 생성
              </h2>
              <div className="mb-4">
                <p className="text-gray-400 text-sm mb-3">
                  {referenceImage
                    ? "참조 이미지를 기반으로 영상 소스를 생성합니다. 페르소나 생성 없이 바로 진행 가능합니다."
                    : "위에서 생성한 페르소나를 활용하여 영상 소스를 만듭니다."}{" "}
                  대본 또는 시퀀스별 장면을 입력해주세요.
                </p>
                <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-4 mb-4">
                  <p className="text-green-200 text-sm mb-2">
                    <strong>입력 방법:</strong>
                  </p>
                  <ul className="text-green-300 text-sm space-y-1 ml-4">
                    <li>
                      • <strong>전체 대본:</strong> 완전한 스크립트나 스토리를
                      입력
                    </li>
                    <li>
                      • <strong>시퀀스별 장면:</strong> 각 줄에 하나씩 장면
                      설명을 입력
                    </li>
                  </ul>
                </div>
              </div>

              {/* 일관성 유지 (선택사항) - 영상 소스 생성으로 이동 */}
              <div className="mb-6 bg-green-900/20 border border-green-500/50 rounded-lg p-6">
                <h3 className="text-green-300 font-medium mb-3 flex items-center">
                  <span className="mr-2">🎨</span>
                  일관성 유지 (선택사항)
                </h3>
                <p className="text-green-200 text-sm mb-3">
                  참조 이미지를 업로드하면 해당 이미지의 스타일과 일관성을
                  유지하며 영상 소스를 생성합니다.
                  {!referenceImage &&
                    " 참조 이미지가 있으면 페르소나 생성 없이도 바로 영상 소스를 만들 수 있습니다!"}
                </p>

                {!referenceImage ? (
                  <div className="border-2 border-dashed border-green-400 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleReferenceImageUpload}
                      className="hidden"
                      id="referenceImageInput"
                    />
                    <label
                      htmlFor="referenceImageInput"
                      className="cursor-pointer flex flex-col items-center space-y-2 hover:text-green-300 transition-colors"
                    >
                      <div className="text-3xl">📸</div>
                      <div className="text-green-300 font-medium">
                        참조 이미지 업로드
                      </div>
                      <div className="text-green-400 text-sm">
                        클릭하여 이미지를 선택하세요
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className="relative bg-gray-900 rounded-lg p-4">
                    <div className="flex items-center space-x-4">
                      <img
                        src={`data:image/jpeg;base64,${referenceImage}`}
                        alt="참조 이미지"
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <div className="text-green-300 font-medium">
                          참조 이미지 업로드됨
                        </div>
                        <div className="text-green-400 text-sm">
                          이 이미지의 스타일을 참고하여 영상 소스를 생성합니다
                        </div>
                      </div>
                      <button
                        onClick={handleRemoveReferenceImage}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <textarea
                value={videoSourceScript}
                onChange={(e) => setVideoSourceScript(e.target.value)}
                placeholder="대본 전체를 넣으세요. 또는 시퀀스별 원하는 장면을 넣으세요.

예시:
1. 미래 도시 옥상에서 로봇이 새벽을 바라보며 서 있는 장면
2. 공중정원에서 홀로그램 나비들이 춤추는 모습  
3. 네온사인이 반사된 빗속 거리를 걸어가는 사이보그
4. 우주 정거장 창문 너머로 지구를 내려다보는 장면"
                className="w-full h-48 p-4 bg-gray-900 border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200 resize-y mb-4"
              />

              {/* 생성 옵션 설정 */}
              <div className="mb-4 bg-green-900/20 border border-green-500/50 rounded-lg p-4">
                <h3 className="text-green-300 font-medium mb-3 flex items-center">
                  <span className="mr-2">⚙️</span>
                  생성 옵션 설정
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 자막 설정 */}
                  <div>
                    <label className="block text-sm font-medium text-green-200 mb-2">
                      💬 자막 설정
                    </label>
                    <select
                      value={subtitleEnabled ? "on" : "off"}
                      onChange={(e) =>
                        setSubtitleEnabled(e.target.value === "on")
                      }
                      className="w-full p-2 bg-gray-800 border border-gray-600 rounded-lg text-green-200 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="off">🚫 자막 OFF (기본값)</option>
                      <option value="on">📝 자막 ON</option>
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      자막 포함 여부를 선택하세요
                    </p>
                  </div>

                  {/* 이미지 수 설정 */}
                  <div>
                    <Slider
                      label="생성할 이미지 수"
                      min={5}
                      max={20}
                      value={Math.min(imageCount, 20)}
                      onChange={(e) => setImageCount(parseInt(e.target.value))}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      안정적인 생성을 위해 최대 20개로 제한
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={handleGenerateVideoSource}
                  disabled={
                    isLoadingVideoSource ||
                    !videoSourceScript.trim() ||
                    !apiKey.trim() ||
                    (characters.length === 0 && !referenceImage) ||
                    (hasContentWarning && !isContentWarningAcknowledged)
                  }
                  className="w-full sm:w-auto px-6 py-3 bg-green-600 font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
                >
                  {isLoadingVideoSource ? (
                    <>
                      <Spinner size="sm" />{" "}
                      <span className="ml-2">영상 소스 생성 중...</span>
                    </>
                  ) : (
                    "영상 소스 생성"
                  )}
                </button>
                {characters.length === 0 && !referenceImage && (
                  <p className="text-yellow-400 text-sm mt-2">
                    ⚠️ 영상 소스를 생성하려면 위에서 페르소나를 먼저 생성하거나, 참조 이미지를 업로드해주세요.
                  </p>
                )}
              </div>
            </section>

            {/* 영상 소스 생성 관련 오류 표시 */}
            {error && (
              <div className="bg-red-900/50 border border-red-500 text-red-300 p-4 rounded-lg">
                <div className="flex items-start">
                  <span className="text-red-400 text-xl mr-3">
                    {error.startsWith("⚠️") ? "⚠️" : "❌"}
                  </span>
                  <div className="flex-1">
                    <pre className="font-medium mb-2 whitespace-pre-wrap text-sm leading-relaxed">{error}</pre>
                  </div>
                </div>
              </div>
            )}

            {isLoadingVideoSource && (
              <div className="text-center p-8">
                <Spinner size="lg" />
                <p className="mt-4 text-green-300 text-lg font-semibold">
                  장면을 만들고 있습니다...
                </p>
                {loadingProgress && (
                  <div className="mt-4 bg-green-900/30 border border-green-500/50 rounded-lg p-4 max-w-md mx-auto">
                    <p className="text-green-300 font-bold text-lg animate-pulse">
                      🎬 {loadingProgress}
                    </p>
                  </div>
                )}
                <p className="mt-4 text-gray-400 text-sm">
                  ⏳ API 과부하 방지를 위해 이미지 간 3-4초 대기 시간이 있습니다.
                </p>
                <p className="mt-2 text-gray-500 text-xs">
                  이 작업은 시간이 걸릴 수 있습니다. 잠시만 기다려 주세요.
                </p>
              </div>
            )}

            {videoSource.length > 0 && (
              <section>
                <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                  <h2 className="text-2xl font-bold text-indigo-300">
                    생성된 영상 소스
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={handleGenerateVideoSource}
                      disabled={
                        isLoadingVideoSource ||
                        !videoSourceScript.trim() ||
                        !apiKey.trim() ||
                        (hasContentWarning && !isContentWarningAcknowledged)
                      }
                      className="px-4 py-2 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center"
                    >
                      {isLoadingVideoSource ? (
                        <>
                          <Spinner size="sm" />
                          <span className="ml-2">생성 중...</span>
                        </>
                      ) : (
                        "한 번 더 생성"
                      )}
                    </button>
                    <button
                      onClick={handleDownloadAllImages}
                      disabled={isDownloading}
                      className="px-4 py-2 bg-green-600 font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center"
                    >
                      {isDownloading ? (
                        <>
                          <Spinner size="sm" />
                          <span className="ml-2">압축 중...</span>
                        </>
                      ) : (
                        "모든 이미지 저장"
                      )}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {videoSource.map((item) => (
                    <StoryboardImage
                      key={item.id}
                      item={item}
                      onRegenerate={handleRegenerateVideoSourceImage}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 광고 3: 영상 소스 생성과 카메라 앵글 생성 사이 */}
            <AdBanner />

            {/* 4단계: 카메라 앵글 확장 */}
            <section className="bg-gray-800 p-6 rounded-xl shadow-2xl border-2 border-orange-500">
              <h2 className="text-2xl font-bold mb-4 text-orange-400 flex items-center">
                <span className="mr-2">4️⃣</span>
                사진 구도 확장 (최대 6가지 앵글)
              </h2>
              <p className="text-orange-200 text-sm mb-4">
                원하는 앵글을 선택하여 다양한 구도의 이미지를 생성합니다.
              </p>

              {/* 중요 안내 */}
              <div className="mb-4 bg-blue-900/20 border border-blue-500/50 rounded-lg p-4">
                <p className="text-blue-300 text-sm font-semibold mb-2">
                  🎬 작동 방식
                </p>
                <ul className="text-blue-200 text-xs space-y-1 list-disc list-inside">
                  <li><strong>1단계:</strong> Gemini Vision AI가 업로드한 이미지를 상세히 분석 (피사체, 조명, 스타일 등)</li>
                  <li><strong>2단계:</strong> 분석 결과를 바탕으로 선택한 앵글별로 이미지 재생성</li>
                  <li><strong>목표:</strong> 동일한 피사체를 다양한 카메라 각도에서 표현</li>
                  <li><strong>유의사항:</strong> AI 재생성이므로 100% 동일하지 않을 수 있음</li>
                  <li><strong>처리 시간:</strong> API 제한으로 앵글당 5-6초 소요 (6개 선택 시 약 30-40초)</li>
                </ul>
              </div>

              {/* 이미지 업로드 섹션 */}
              <div className="mb-6 bg-orange-900/20 border border-orange-500/50 rounded-lg p-6">
                <h3 className="text-orange-300 font-medium mb-3 flex items-center">
                  <span className="mr-2">📸</span>
                  분석할 원본 이미지 업로드
                </h3>
                <p className="text-orange-200 text-sm mb-3">
                  이미지를 업로드하면 AI가 상세히 분석한 후, 선택한 카메라 앵글로 재생성합니다.
                </p>

                {!cameraAngleSourceImage ? (
                  <div className="border-2 border-dashed border-orange-400 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleCameraAngleImageUpload}
                      className="hidden"
                      id="cameraAngleImageInput"
                    />
                    <label
                      htmlFor="cameraAngleImageInput"
                      className="cursor-pointer flex flex-col items-center space-y-2 hover:text-orange-300 transition-colors"
                    >
                      <div className="text-3xl">🎬</div>
                      <div className="text-orange-300 font-medium">
                        원본 이미지 업로드
                      </div>
                      <div className="text-orange-400 text-sm">
                        클릭하여 이미지를 선택하세요
                      </div>
                      <div className="text-orange-300 text-xs mt-2">
                        JPG, PNG, WEBP 형식 지원 (최대 10MB)
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className="relative bg-gray-900 rounded-lg p-4">
                    <div className="flex items-center space-x-4">
                      <img
                        src={cameraAngleSourceImage}
                        alt="카메라 앵글 원본 이미지"
                        className="w-20 h-20 object-cover rounded-lg border-2 border-orange-400"
                      />
                      <div className="flex-1">
                        <p className="text-orange-300 font-medium">원본 이미지 업로드 완료</p>
                        <p className="text-orange-400 text-sm">10가지 앵글로 변환할 준비가 되었습니다</p>
                      </div>
                      <button
                        onClick={() => {
                          setCameraAngleSourceImage(null);
                          setCameraAngles([]);
                          setCameraAngleError(null);
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-semibold"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 앵글 선택 섹션 */}
              <div className="mb-6 bg-orange-900/20 border border-orange-500/50 rounded-lg p-6">
                <h3 className="text-orange-300 font-medium mb-3 flex items-center">
                  <span className="mr-2">✅</span>
                  생성할 앵글 선택 ({selectedCameraAngles.length}/6)
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'Front View' as CameraAngle, label: '정면', emoji: '👤', direction: '' },
                    { value: 'Right Side View' as CameraAngle, label: '오른쪽 측면', emoji: '👉', direction: '(왼쪽을 바라봄)' },
                    { value: 'Left Side View' as CameraAngle, label: '왼쪽 측면', emoji: '👈', direction: '(오른쪽을 바라봄)' },
                    { value: 'Back View' as CameraAngle, label: '뒷모습', emoji: '🔙', direction: '' },
                    { value: 'Full Body' as CameraAngle, label: '전신', emoji: '🧍', direction: '' },
                    { value: 'Close-up Face' as CameraAngle, label: '얼굴 근접', emoji: '😊', direction: '' },
                  ].map((angle) => (
                    <label
                      key={angle.value}
                      className={`flex items-center p-3 rounded-lg cursor-pointer transition-all ${
                        selectedCameraAngles.includes(angle.value)
                          ? 'bg-orange-600/40 border-2 border-orange-400'
                          : 'bg-gray-700/50 border-2 border-gray-600 hover:bg-gray-600/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCameraAngles.includes(angle.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCameraAngles([...selectedCameraAngles, angle.value]);
                          } else {
                            setSelectedCameraAngles(selectedCameraAngles.filter(a => a !== angle.value));
                          }
                        }}
                        className="w-5 h-5 mr-3"
                      />
                      <span className="text-xl mr-2">{angle.emoji}</span>
                      <div className="flex flex-col">
                        <span className="text-orange-200 font-medium text-sm">{angle.label}</span>
                        {angle.direction && (
                          <span className="text-orange-300/60 text-xs">{angle.direction}</span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex space-x-2">
                  <button
                    onClick={() => setSelectedCameraAngles([
                      'Front View', 'Right Side View', 'Left Side View', 'Back View', 'Full Body', 'Close-up Face'
                    ])}
                    className="px-3 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700"
                  >
                    전체 선택
                  </button>
                  <button
                    onClick={() => setSelectedCameraAngles([])}
                    className="px-3 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                  >
                    전체 해제
                  </button>
                </div>
              </div>

              {/* 비율 선택 */}
              <div className="mb-4">
                <label className="block text-orange-300 text-sm mb-2 font-semibold">
                  📐 생성할 이미지 비율
                </label>
                <AspectRatioSelector
                  selectedRatio={aspectRatio}
                  onRatioChange={setAspectRatio}
                />
              </div>

              {/* 생성 버튼 - 로딩 중이 아닐 때만 표시 */}
              {!isLoadingCameraAngles && (
                <>
                  <button
                    onClick={handleGenerateCameraAngles}
                    disabled={!cameraAngleSourceImage || !apiKey || selectedCameraAngles.length === 0}
                    className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
                      !cameraAngleSourceImage || !apiKey || selectedCameraAngles.length === 0
                        ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-lg hover:shadow-xl transform hover:scale-105"
                    }`}
                  >
                    🎬 선택한 {selectedCameraAngles.length}가지 앵글 생성하기
                  </button>

                  {!apiKey && (
                    <p className="text-yellow-400 text-sm mt-2">
                      ⚠️ API ?를 먼저 입력해주세요
                    </p>
                  )}
                </>
              )}

              {/* 로딩 중 진행 상황 표시 - 주황색 박스만 표시 */}
              {isLoadingCameraAngles && cameraAngleProgress && (
                <div className="mt-6">
                  <div className="bg-gradient-to-br from-orange-900/40 to-orange-800/30 border-2 border-orange-500 rounded-xl p-8 shadow-2xl">
                    <div className="flex flex-col items-center space-y-4">
                      <Spinner size="lg" />
                      <div className="text-center">
                        <p className="text-orange-300 font-bold text-2xl animate-pulse">
                          🎬 {cameraAngleProgress}
                        </p>
                        <p className="mt-3 text-orange-400 text-base">
                          ⏳ 앵글 간 5-6초 대기 (API 할당량 보호)
                        </p>
                        <p className="mt-2 text-orange-500 text-sm">
                          선택한 {selectedCameraAngles.length}가지 앵글 생성에는 약 {Math.ceil(selectedCameraAngles.length * 6 / 60)}분 소요
                        </p>
                        <div className="mt-4 bg-orange-950/50 rounded-lg p-3">
                          <p className="text-orange-300 text-xs">
                            💡 생성 중에는 브라우저를 닫지 마세요
                          </p>
                          <p className="text-orange-400 text-xs mt-1">
                            ⚠️ 할당량 초과 시 생성된 이미지만 저장됩니다
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 에러 메시지 */}
              {cameraAngleError && !isLoadingCameraAngles && (
                <div className="mt-4 p-4 bg-red-900/30 border border-red-600 rounded-lg">
                  <pre className="text-red-400 text-sm whitespace-pre-wrap font-mono">
                    {cameraAngleError}
                  </pre>
                </div>
              )}

              {/* 생성된 카메라 앵글 결과 그리드 */}
              {cameraAngles.length > 0 && !isLoadingCameraAngles && (
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-orange-300">
                      🎬 생성된 카메라 앵글 ({cameraAngles.length}개)
                    </h3>
                    <button
                      onClick={async () => {
                        try {
                          let successCount = 0;
                          let cancelCount = 0;
                          
                          for (let index = 0; index < cameraAngles.length; index++) {
                            const angleImg = cameraAngles[index];
                            const fileName = `${index + 1}_${angleImg.angleName}.png`;
                            
                            try {
                              const base64Data = angleImg.image.includes(',') 
                                ? angleImg.image.split(',')[1] 
                                : angleImg.image;
                              const base64Response = await fetch(`data:image/png;base64,${base64Data}`);
                              const blob = await base64Response.blob();
                              
                              if ('showSaveFilePicker' in window) {
                                try {
                                  const handle = await (window as any).showSaveFilePicker({
                                    suggestedName: fileName,
                                    types: [
                                      {
                                        description: '이미지 파일',
                                        accept: {
                                          'image/png': ['.png'],
                                        },
                                      },
                                    ],
                                  });
                                  
                                  const writable = await handle.createWritable();
                                  await writable.write(blob);
                                  await writable.close();
                                  successCount++;
                                } catch (err: any) {
                                  if (err.name === 'AbortError') {
                                    cancelCount++;
                                    console.log(`[${index + 1}/${cameraAngles.length}] 사용자가 저장을 취소했습니다.`);
                                  } else {
                                    throw err;
                                  }
                                }
                              } else {
                                const link = document.createElement('a');
                                link.href = URL.createObjectURL(blob);
                                link.download = fileName;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                URL.revokeObjectURL(link.href);
                                successCount++;
                                await new Promise(resolve => setTimeout(resolve, 300));
                              }
                            } catch (err) {
                              console.error(`[개발자용] 카메라 앵글 ${index + 1} 다운로드 오류:`, err);
                              throw err;
                            }
                          }
                          
                          if (successCount > 0) {
                            setCameraAngleError(`✅ ${successCount}개의 카메라 앵글이 저장되었습니다!` + 
                                    (cancelCount > 0 ? ` (${cancelCount}개 취소됨)` : ''));
                          } else if (cancelCount > 0) {
                            setCameraAngleError(`모든 다운로드가 취소되었습니다.`);
                          }
                        } catch (error) {
                          console.error("[개발자용] 카메라 앵글 다운로드 오류:", error);
                          
                          let userMessage = "카메라 앵글 다운로드에 실패했습니다. 다시 시도해 주세요.";
                          
                          if (error instanceof Error) {
                            console.error(`[개발자용] 오류 상세: ${error.name} - ${error.message}`);
                            
                            if (error.name === 'NotAllowedError') {
                              userMessage = "파일 저장 권한이 거부되었습니다. 브라우저 설정을 확인해 주세요.";
                            } else if (error.name === 'SecurityError') {
                              userMessage = "보안 문제로 파일을 저장할 수 없습니다. 브라우저를 업데이트하거나 다른 브라우저를 사용해 주세요.";
                            }
                          }
                          
                          setCameraAngleError(userMessage);
                        }
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold"
                    >
                      📥 전체 다운로드 ({cameraAngles.length}개)
                    </button>
                  </div>

                  {/* 4열 x 5행 그리드 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {cameraAngles.map((angleImg) => (
                      <div
                        key={angleImg.id}
                        className="bg-gray-700 rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-all transform hover:scale-105"
                      >
                        <div className="relative aspect-square">
                          <img
                            src={angleImg.image}
                            alt={angleImg.angleName}
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => {
                              // 새창으로 이미지 열기
                              openImageInNewWindow(angleImg.image, `카메라 앵글 - ${angleImg.angleName}`);
                            }}
                          />
                        </div>
                        <div className="p-3">
                          <h4 className="font-bold text-white text-sm mb-1">
                            {angleImg.angleName}
                          </h4>
                          <p className="text-gray-400 text-xs mb-2 line-clamp-2">
                            {angleImg.description}
                          </p>
                          <button
                            onClick={async () => {
                              try {
                                // Base64를 Blob으로 변환
                                const response = await fetch(angleImg.image);
                                const blob = await response.blob();
                                
                                // File System Access API 지원 확인
                                if ('showSaveFilePicker' in window) {
                                  try {
                                    const handle = await (window as any).showSaveFilePicker({
                                      suggestedName: `???-??-${angleImg.angle}.jpg`,
                                      types: [
                                        {
                                          description: '이미지 파일',
                                          accept: {
                                            'image/jpeg': ['.jpg', '.jpeg'],
                                          },
                                        },
                                      ],
                                    });
                                    
                                    const writable = await handle.createWritable();
                                    await writable.write(blob);
                                    await writable.close();
                                  } catch (err: any) {
                                    if (err.name !== 'AbortError') {
                                      throw err;
                                    }
                                  }
                                } else {
                                  // 폴백: 기존 다운로드 방식
                                  const link = document.createElement('a');
                                  link.href = URL.createObjectURL(blob);
                                  link.download = `???-??-${angleImg.angle}.jpg`;
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                  URL.revokeObjectURL(link.href);
                                }
                              } catch (error) {
                                console.error("[개발자용] 이미지 다운로드 오류:", error);
                              }
                            }}
                            className="w-full py-2 bg-orange-600 text-white rounded text-xs font-semibold hover:bg-orange-700 transition-colors"
                          >
                            💾 다운로드
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* 영상 제작 도구 배너 */}
            <section className="my-8">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-lg shadow-lg text-center">
                <h3 className="text-xl font-bold mb-2">
                  🎬 더 많은 영상 제작 도구가 필요하신가요?
                </h3>
                <p className="mb-4">
                  프로페셔널한 영상 편집과 효과를 위한 도구들을 확인해보세요!
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <a
                    href="https://youtube.money-hotissue.com"
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 transform hover:scale-105 transition-all shadow-md hover:shadow-xl cursor-pointer"
                  >
                    📈 떡상한 대본 1분 카피
                  </a>
                  <a
                    href="https://aimusic.money-hotissue.com/"
                    className="px-6 py-3 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-lg font-semibold hover:from-pink-600 hover:to-pink-700 transform hover:scale-105 transition-all shadow-md hover:shadow-xl cursor-pointer"
                  >
                    🎵 AI 음악 가사 1초 완성
                  </a>
                  <a
                    href="https://aimusic.money-hotissue.com/"
                    className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-indigo-700 transform hover:scale-105 transition-all shadow-md hover:shadow-xl cursor-pointer"
                  >
                    🎨 AI 음악 썸네일 제작
                  </a>
                </div>
              </div>
            </section>
          </main>

          {/* Footer */}
          <footer className="mt-16 py-8 border-t border-gray-700">
            <div className="max-w-4xl mx-auto px-4">
              <div className="text-center space-y-4">
                {/* 저작권 표시 */}
                <p className="text-gray-500 text-sm">
                  © {new Date().getFullYear()} 유튜브 롱폼 이미지 생성기. All
                  rights reserved.
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>
      <FloatingBottomAd />

      {/* 초기화 버튼 - 오른쪽 하단 고정 */}
      <button
        onClick={handleResetAll}
        className="fixed bottom-24 right-6 z-[10000] px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 flex items-center gap-2 border-2 border-red-500"
        title="모든 작업 데이터 초기화"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
            clipRule="evenodd"
          />
        </svg>
        초기화
      </button>
    </>
  );
};

export default App;
