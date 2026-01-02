import React, { useState, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FiSettings, FiTrash2 } from "react-icons/fi";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  analyzeTranscript,
  generateNewPlan,
  generateIdeas,
} from "./services/geminiService";
import {
  generateChapterOutline,
  generateChapterScript,
} from "./services/chapterService";
import { getVideoDetails } from "./services/youtubeService";
import type { VideoDetails } from "./services/youtubeService";
import type {
  AnalysisResult,
  NewPlan,
  ScriptStage,
  OutlineStage,
  StructuredContent,
  ScriptQuote,
} from "./types";
import ResultCard from "./components/ResultCard";
import KeywordPill from "./components/KeywordPill";
import Loader from "./components/Loader";
import ApiKeyModal from "./components/ApiKeyModal";
import AdSense from "./components/AdSense";
import Footer from "./components/Footer";
import AdBlockDetector from "./components/AdBlockDetector";
import AdBlockWarningModal from "./components/AdBlockWarningModal";
import FloatingAnchorAd from "./components/FloatingAnchorAd";
import SidebarAds from "./components/SidebarAds";
import { getStoredApiKey, saveApiKey } from "./utils/apiKeyStorage";
import { highlightImportantText } from "./utils/textHighlight.tsx";
import { useNavigate } from "react-router-dom";
import { fetchTranscript } from "./services/transcriptService";

const defaultCategories = [
  "썰 채널",
  "건강",
  "미스터리",
  "야담",
  "49금",
  "국뽕",
  "북한 이슈",
  "정보 전달",
  "쇼핑 리뷰",
  "IT/테크",
  "요리/쿡방",
  "뷰티",
  "게임",
  "먹방",
  "브이로그",
];
const lengthOptions = ["8분", "30분", "1시간"];
const contentTypes = ["숏폼", "롱폼"];
const vlogTypes = [
  "모닝 루틴",
  "다이어트",
  "여행",
  "언박싱",
  "패션",
  "공부",
  "운동",
  "일상",
  "데이트",
  "요리",
];
const characterColors = [
  "text-red-400",
  "text-cyan-400",
  "text-green-400",
  "text-yellow-400",
  "text-purple-400",
  "text-orange-400",
];

// SortableItem 컴포넌트
interface SortableItemProps {
  id: string;
  category: string;
  isSelected: boolean;
  onClick: () => void;
}

const SortableItem: React.FC<SortableItemProps> = ({
  id,
  category,
  isSelected,
  onClick,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
        isSelected
          ? "bg-gradient-to-br from-[#D90000] to-[#FF2B2B] text-white shadow-[0_0_10px_rgba(255,43,43,0.5)]"
          : "bg-[#2A2A2A] hover:bg-zinc-700 text-neutral-200"
      }`}
      {...attributes}
      {...listeners}
    >
      {category}
    </button>
  );
};

const App: React.FC = () => {
  const navigate = useNavigate();
  // 카테고리 순서 관리
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem("categoriesOrder");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to restore categories order:", e);
      }
    }
    return defaultCategories;
  });

  const [youtubeUrl, setYoutubeUrl] = useState<string>("");
  const [transcript, setTranscript] = useState<string>("");
  const [newKeyword, setNewKeyword] = useState<string>("");
  const [userIdeaKeyword, setUserIdeaKeyword] = useState<string>("");
  const [appliedIdeaKeyword, setAppliedIdeaKeyword] = useState<string>("");
  const [isFetchingTranscript, setIsFetchingTranscript] = useState<boolean>(false);

  // localStorage에서 저장된 데이터 복원
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(() => {
    const saved = localStorage.getItem("analysisResult");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to restore analysis result:", e);
      }
    }
    return null;
  });
  
  const [newPlan, setNewPlan] = useState<NewPlan | null>(() => {
    const saved = localStorage.getItem("newPlan");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to restore new plan:", e);
      }
    }
    return null;
  });
  
  const [suggestedIdeas, setSuggestedIdeas] = useState<string[]>(() => {
    const saved = localStorage.getItem("suggestedIdeas");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to restore suggested ideas:", e);
      }
    }
    return [];
  });

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState<boolean>(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  // API 키 검증 로직 제거됨
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>(
    categories[0]
  );
  const [selectedVlogType, setSelectedVlogType] = useState<string>(
    vlogTypes[0]
  );
  const [contentType, setContentType] = useState<string>("롱폼");
  const [lengthMode, setLengthMode] = useState<string>("8분");
  const [customLength, setCustomLength] = useState<string>("8분");
  const [scriptStyle, setScriptStyle] = useState<string>("대화 버전"); // "대화 버전" | "나레이션 버전"

  const [videoDetails, setVideoDetails] = useState<VideoDetails | null>(null);
  const [characterColorMap, setCharacterColorMap] = useState(
    new Map<string, string>()
  );

  // API 키 관리
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);

  // 애드블럭 감지
  const [adBlockDetected, setAdBlockDetected] = useState<boolean>(false);

  const handleAdBlockDetected = () => {
    setAdBlockDetected(true);
  };

  // 드래그 앤 드롭 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px 이상 드래그해야 활성화
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 드래그 종료 핸들러
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setCategories((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // API 키 로드
  useEffect(() => {
    const storedKey = getStoredApiKey();
    if (storedKey) {
      setApiKey(storedKey);
    }
  }, []);

  // 카테고리 순서 저장
  useEffect(() => {
    localStorage.setItem("categoriesOrder", JSON.stringify(categories));
  }, [categories]);

  // 분석 결과 저장 (localStorage)
  useEffect(() => {
    if (analysisResult) {
      localStorage.setItem("analysisResult", JSON.stringify(analysisResult));
      localStorage.setItem("lastAnalysisTimestamp", Date.now().toString());
    }
  }, [analysisResult]);

  // 생성된 기획안 저장 (localStorage)
  useEffect(() => {
    if (newPlan) {
      localStorage.setItem("newPlan", JSON.stringify(newPlan));
      localStorage.setItem("lastPlanTimestamp", Date.now().toString());
    }
  }, [newPlan]);

  // 추천 아이디어 저장 (localStorage)
  useEffect(() => {
    if (suggestedIdeas.length > 0) {
      localStorage.setItem("suggestedIdeas", JSON.stringify(suggestedIdeas));
    }
  }, [suggestedIdeas]);

  // 트랜스크립트 저장
  useEffect(() => {
    if (transcript) {
      localStorage.setItem("lastTranscript", transcript);
    }
  }, [transcript]);

  // YouTube URL 저장
  useEffect(() => {
    if (youtubeUrl) {
      localStorage.setItem("lastYoutubeUrl", youtubeUrl);
    }
  }, [youtubeUrl]);

  // 등장인물 색상 복원
  useEffect(() => {
    if (newPlan && newPlan.characters) {
      const colorMap = new Map<string, string>();
      newPlan.characters.forEach((char, idx) => {
        colorMap.set(char, characterColors[idx % characterColors.length]);
      });
      setCharacterColorMap(colorMap);
    }
  }, [newPlan]);

  useEffect(() => {
    if (newKeyword) {
      localStorage.setItem("lastNewKeyword", newKeyword);
    }
  }, [newKeyword]);

  // 페이지 로드 시 저장된 데이터 복원 (24시간 이내)
  useEffect(() => {
    const restoreData = () => {
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24시간

      // 분석 결과 복원
      const savedAnalysis = localStorage.getItem("lastAnalysisResult");
      const analysisTimestamp = localStorage.getItem("lastAnalysisTimestamp");
      if (savedAnalysis && analysisTimestamp) {
        const age = now - parseInt(analysisTimestamp);
        if (age < maxAge) {
          try {
            setAnalysisResult(JSON.parse(savedAnalysis));
          } catch (e) {
            console.error("Failed to restore analysis result:", e);
          }
        }
      }

      // 새 기획안 복원
      const savedPlan = localStorage.getItem("lastNewPlan");
      const planTimestamp = localStorage.getItem("lastNewPlanTimestamp");
      if (savedPlan && planTimestamp) {
        const age = now - parseInt(planTimestamp);
        if (age < maxAge) {
          try {
            setNewPlan(JSON.parse(savedPlan));
          } catch (e) {
            console.error("Failed to restore new plan:", e);
          }
        }
      }

      // 아이디어 복원
      const savedIdeas = localStorage.getItem("lastSuggestedIdeas");
      if (savedIdeas) {
        try {
          setSuggestedIdeas(JSON.parse(savedIdeas));
        } catch (e) {
          console.error("Failed to restore ideas:", e);
        }
      }

      // 입력값 복원
      const savedTranscript = localStorage.getItem("lastTranscript");
      if (savedTranscript) {
        setTranscript(savedTranscript);
      }

      const savedUrl = localStorage.getItem("lastYoutubeUrl");
      if (savedUrl) {
        setYoutubeUrl(savedUrl);
      }

      const savedKeyword = localStorage.getItem("lastNewKeyword");
      if (savedKeyword) {
        setNewKeyword(savedKeyword);
      }
    };

    restoreData();
  }, []); // 최초 한 번만 실행

  useEffect(() => {
    const fetchVideoDetails = async () => {
      const trimmedUrl = youtubeUrl.trim();
      if (!trimmedUrl) {
        setVideoDetails(null);
        setError(null);
        return;
      }

      setIsFetchingDetails(true);
      setError(null);
      try {
        const details = await getVideoDetails(youtubeUrl);
        setVideoDetails(details);
      } catch (err) {
        setVideoDetails(null);
        setError(
          "유효하지 않은 YouTube URL이거나 영상 정보를 가져올 수 없습니다."
        );
      } finally {
        setIsFetchingDetails(false);
      }
    };

    const timer = setTimeout(() => {
      fetchVideoDetails();
    }, 300);

    return () => clearTimeout(timer);
  }, [youtubeUrl]);

  useEffect(() => {
    if (lengthMode !== "custom") {
      setCustomLength(lengthMode);
    }
  }, [lengthMode]);

  useEffect(() => {
    if (newPlan?.characters) {
      const newMap = new Map<string, string>();
      newPlan.characters.forEach((char, index) => {
        newMap.set(char, characterColors[index % characterColors.length]);
      });
      setCharacterColorMap(newMap);
    }
  }, [newPlan]);

  // 강력한 복사/드래그/우클릭 방지 시스템
  useEffect(() => {
    // API 키 모달이 열려있으면 선택 해제 기능 비활성화
    if (showApiKeyModal) {
      return;
    }
    // 다층 방어 함수들
    const preventAction = (e: Event) => {
      // API 키 모달, 유튜브 URL 입력, 대본 입력, 새 아이디어 입력, 새 제목 입력 내부는 허용
      const target = e.target as HTMLElement;
      if (
        target?.closest(".api-key-modal") ||
        target?.closest(".youtube-url-input") ||
        target?.closest(".transcript-input") ||
        target?.closest(".user-idea-keyword-input") ||
        target?.closest(".new-title-input")
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const preventCopy = (e: ClipboardEvent) => {
      // API 키 모달, 유튜브 URL 입력, 대본 입력, 새 아이디어 입력, 새 제목 입력 내부는 허용
      const target = e.target as HTMLElement;
      if (
        target?.closest(".api-key-modal") ||
        target?.closest(".youtube-url-input") ||
        target?.closest(".transcript-input") ||
        target?.closest(".user-idea-keyword-input") ||
        target?.closest(".new-title-input")
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      e.clipboardData?.clearData();
      return false;
    };

    const preventDrag = (e: DragEvent) => {
      // API 키 모달, 유튜브 URL 입력, 대본 입력, 새 아이디어 입력, 새 제목 입력 내부는 허용
      const target = e.target as HTMLElement;
      if (
        target?.closest(".api-key-modal") ||
        target?.closest(".youtube-url-input") ||
        target?.closest(".transcript-input") ||
        target?.closest(".user-idea-keyword-input") ||
        target?.closest(".new-title-input")
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const preventSelect = (e: Event) => {
      // API 키 모달, 유튜브 URL 입력, 대본 입력, 새 아이디어 입력, 새 제목 입력 내부는 허용
      const target = e.target as HTMLElement;
      if (
        target?.closest(".api-key-modal") ||
        target?.closest(".youtube-url-input") ||
        target?.closest(".transcript-input") ||
        target?.closest(".user-idea-keyword-input") ||
        target?.closest(".new-title-input")
      ) {
        return;
      }
      e.preventDefault();
      return false;
    };

    const preventPaste = (e: ClipboardEvent) => {
      // API 키 모달, 유튜브 URL 입력, 대본 입력, 새 아이디어 입력, 새 제목 입력 내부는 허용
      const target = e.target as HTMLElement;
      if (
        target?.closest(".api-key-modal") ||
        target?.closest(".youtube-url-input") ||
        target?.closest(".transcript-input") ||
        target?.closest(".user-idea-keyword-input") ||
        target?.closest(".new-title-input")
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const disableTextSelection = () => {
      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";
      (document.body.style as any).msUserSelect = "none";
      (document.body.style as any).MozUserSelect = "none";
    };

    const preventKeyboardShortcuts = (e: KeyboardEvent) => {
      // API 키 모달, 유튜브 URL 입력, 대본 입력, 새 아이디어 입력, 새 제목 입력 내부는 허용
      const target = e.target as HTMLElement;
      if (
        target?.closest(".api-key-modal") ||
        target?.closest(".youtube-url-input") ||
        target?.closest(".transcript-input") ||
        target?.closest(".user-idea-keyword-input") ||
        target?.closest(".new-title-input")
      ) {
        return;
      }

      // Ctrl+C, Ctrl+X, Ctrl+A, Ctrl+U, Ctrl+S, Ctrl+P, F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+Shift+S, PrintScreen, Win+Shift+S
      // 알캡처(ALCapture) 단축키: Ctrl+Shift+C/W/D/A/S/F
      // Ctrl+Shift+R은 새로고침을 위해 허용
      if (
        (e.ctrlKey && (e.key === "c" || e.key === "C")) ||
        (e.ctrlKey && (e.key === "x" || e.key === "X")) ||
        (e.ctrlKey && (e.key === "a" || e.key === "A")) ||
        (e.ctrlKey && (e.key === "u" || e.key === "U")) ||
        (e.ctrlKey && (e.key === "s" || e.key === "S")) || // 페이지 저장 차단
        (e.ctrlKey && (e.key === "p" || e.key === "P")) || // 인쇄 차단
        (e.ctrlKey && e.shiftKey && (e.key === "i" || e.key === "I")) ||
        (e.ctrlKey && e.shiftKey && (e.key === "j" || e.key === "J")) ||
        (e.ctrlKey && e.shiftKey && (e.key === "c" || e.key === "C")) || // 알캡처: 직접 시작 캡처
        (e.ctrlKey && e.shiftKey && (e.key === "w" || e.key === "W")) || // 알캡처: 창 캡처
        (e.ctrlKey && e.shiftKey && (e.key === "d" || e.key === "D")) || // 알캡처: 단일영역 캡처
        (e.ctrlKey && e.shiftKey && (e.key === "a" || e.key === "A")) || // 알캡처: 전체캡처
        (e.ctrlKey && e.shiftKey && (e.key === "s" || e.key === "S")) || // 알캡처: 스크롤 캡처 / Ctrl+Shift+S 페이지 저장
        (e.ctrlKey && e.shiftKey && (e.key === "f" || e.key === "F")) || // 알캡처: 지정사이즈 캡처
        (e.metaKey && e.shiftKey && (e.key === "s" || e.key === "S")) || // Win+Shift+S 스크린샷 도구 차단
        e.key === "F12" ||
        e.key === "PrintScreen" || // Print Screen 키 차단
        e.keyCode === 44 // Print Screen keyCode
      ) {
        // Ctrl+Shift+R은 허용 (새로고침)
        if (e.ctrlKey && e.shiftKey && (e.key === "r" || e.key === "R")) {
          return; // 이벤트를 차단하지 않음
        }
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // CSS로 선택 방지
    disableTextSelection();

    // 이벤트 리스너 등록 (capture phase에서 차단)
    const events = [
      { type: "contextmenu", handler: preventAction },
      { type: "copy", handler: preventCopy },
      { type: "cut", handler: preventCopy },
      { type: "paste", handler: preventPaste },
      { type: "selectstart", handler: preventSelect },
      { type: "dragstart", handler: preventDrag },
      { type: "drag", handler: preventDrag },
      { type: "dragover", handler: preventDrag },
      { type: "drop", handler: preventDrag },
      { type: "mousedown", handler: preventSelect },
      { type: "keydown", handler: preventKeyboardShortcuts },
    ];

    events.forEach(({ type, handler }) => {
      document.addEventListener(type, handler as EventListener, {
        capture: true,
        passive: false,
      });
    });

    // 주기적으로 스타일 재적용 (우회 방지, API 키 모달, 유튜브 URL 입력, 대본 입력, 새 아이디어 입력, 새 제목 입력 제외)
    const styleInterval = setInterval(() => {
      // API 키 모달, 유튜브 URL 입력, 대본 입력, 새 아이디어 입력, 새 제목 입력이 열려있으면 스킵
      const modal = document.querySelector(".api-key-modal");
      const youtubeInput = document.querySelector(".youtube-url-input");
      const transcriptInput = document.querySelector(".transcript-input");
      const userIdeaInput = document.querySelector(".user-idea-keyword-input");
      const newTitleInput = document.querySelector(".new-title-input");
      if (
        !modal &&
        !youtubeInput &&
        !transcriptInput &&
        !userIdeaInput &&
        !newTitleInput
      ) {
        disableTextSelection();
      }
    }, 1000);

    // Selection API 감시 및 차단 (API 키 모달, 유튜브 URL 입력, 대본 입력, 새 아이디어 입력, 새 제목 입력 제외)
    const clearSelection = () => {
      // API 키 모달, 유튜브 URL 입력, 대본 입력, 새 아이디어 입력, 새 제목 입력이 열려있으면 선택 해제하지 않음
      const modal = document.querySelector(".api-key-modal");
      const youtubeInput = document.querySelector(".youtube-url-input");
      const transcriptInput = document.querySelector(".transcript-input");
      const userIdeaInput = document.querySelector(".user-idea-keyword-input");
      const newTitleInput = document.querySelector(".new-title-input");
      if (
        modal ||
        youtubeInput ||
        transcriptInput ||
        userIdeaInput ||
        newTitleInput
      ) {
        return;
      }

      if (window.getSelection) {
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
          // 선택된 요소가 API 키 모달, 유튜브 URL 입력, 대본 입력, 새 아이디어 입력, 새 제목 입력 내부인지 확인
          try {
            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer;
            const element = (
              container.nodeType === 1 ? container : container.parentElement
            ) as HTMLElement;
            if (
              element?.closest(".api-key-modal") ||
              element?.closest(".youtube-url-input") ||
              element?.closest(".transcript-input") ||
              element?.closest(".user-idea-keyword-input") ||
              element?.closest(".new-title-input")
            ) {
              return;
            }
          } catch (e) {
            // selection이 없는 경우 무시
          }
          selection.removeAllRanges();
        }
      }
    };

    const selectionInterval = setInterval(clearSelection, 100);

    // DevTools 감지 및 경고
    const detectDevTools = () => {
      const threshold = 160;
      if (
        window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold
      ) {
        console.clear();
      }
    };

    const devToolsInterval = setInterval(detectDevTools, 1000);

    // Cleanup
    return () => {
      events.forEach(({ type, handler }) => {
        document.removeEventListener(type, handler as EventListener, {
          capture: true,
        });
      });
      clearInterval(styleInterval);
      clearInterval(selectionInterval);
      clearInterval(devToolsInterval);

      // 스타일 복원
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
      (document.body.style as any).msUserSelect = "";
      (document.body.style as any).MozUserSelect = "";
    };
  }, [showApiKeyModal]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setYoutubeUrl(newUrl);
    setAnalysisResult(null);
    setNewPlan(null);
    setSuggestedIdeas([]);
  };

  const handleRemoveUrl = () => {
    setYoutubeUrl("");
    setAnalysisResult(null);
    setNewPlan(null);
    setSuggestedIdeas([]);
    setError(null);
  };

  // 전체 초기화 함수
  const handleReset = () => {
    const confirmed = window.confirm(
      "모든 분석 내용과 입력값이 초기화됩니다. 계속하시겠습니까?"
    );
    if (!confirmed) return;

    // 상태 초기화
    setYoutubeUrl("");
    setTranscript("");
    setNewKeyword("");
    setAnalysisResult(null);
    setNewPlan(null);
    setSuggestedIdeas([]);
    setVideoDetails(null);
    setError(null);

    // localStorage 초기화
    localStorage.removeItem("lastAnalysisResult");
    localStorage.removeItem("lastAnalysisTimestamp");
    localStorage.removeItem("lastNewPlan");
    localStorage.removeItem("lastNewPlanTimestamp");
    localStorage.removeItem("lastSuggestedIdeas");
    localStorage.removeItem("lastTranscript");
    localStorage.removeItem("lastYoutubeUrl");
    localStorage.removeItem("lastNewKeyword");

    alert("✅ 모든 내용이 초기화되었습니다!");
  };

  const handleSaveApiKey = async (key: string) => {
    saveApiKey(key);
    setApiKey(key);
    setShowApiKeyModal(false);
    alert("✅ API 키가 성공적으로 설정되었습니다!");
  };

  const handleDeleteApiKey = (e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      "API 키 연결을 해제하시겠습니까?\n다시 사용하려면 API 키를 재입력해야 합니다."
    );
    if (confirmed) {
      localStorage.removeItem("gemini_api_key");
      setApiKey(null);
      alert("✅ API 키가 삭제되었습니다. 다시 API 키를 입력해주세요.");
    }
  };

  // 저장된 데이터 초기화
  const handleClearData = () => {
    const confirmed = window.confirm(
      "저장된 모든 데이터를 삭제하시겠습니까?\n(분석 결과, 기획안, 추천 아이디어 등)"
    );
    if (confirmed) {
      localStorage.removeItem("analysisResult");
      localStorage.removeItem("newPlan");
      localStorage.removeItem("suggestedIdeas");
      localStorage.removeItem("lastAnalysisTimestamp");
      localStorage.removeItem("lastPlanTimestamp");
      localStorage.removeItem("lastTranscript");
      localStorage.removeItem("lastYoutubeUrl");
      localStorage.removeItem("lastNewKeyword");
      localStorage.removeItem("lastAnalysisResult");
      localStorage.removeItem("lastNewPlan");
      localStorage.removeItem("lastSuggestedIdeas");
      localStorage.removeItem("lastNewPlanTimestamp");
      
      setAnalysisResult(null);
      setNewPlan(null);
      setSuggestedIdeas([]);
      setTranscript("");
      setYoutubeUrl("");
      setNewKeyword("");
      
      alert("✅ 모든 데이터가 삭제되었습니다.");
    }
  };

  const handleAnalyze = useCallback(async () => {
    if (!apiKey) {
      setShowApiKeyModal(true);
      setError("API 키를 먼저 설정해주세요.");
      return;
    }
    if (!transcript) {
      setError("분석할 스크립트를 입력해주세요.");
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);
    setNewPlan(null);
    setSuggestedIdeas([]);

    try {
      const result = await analyzeTranscript(
        transcript,
        selectedCategory,
        apiKey,
        videoDetails?.title
      );
      setAnalysisResult(result);

      setIsGeneratingIdeas(true);
      try {
        const ideas = await generateIdeas(
          result,
          selectedCategory,
          apiKey,
          appliedIdeaKeyword || undefined
        );
        setSuggestedIdeas(ideas);
      } catch (e: any) {
        console.error("아이디어 생성 오류:", e);
        setError(e.message || "❌ 아이디어 생성 중 알 수 없는 오류가 발생했습니다.\n\n💡 해결 방법:\n• 페이지를 새로고침하고 다시 시도해주세요\n• 문제가 지속되면 개발자에게 문의해주세요");
      } finally {
        setIsGeneratingIdeas(false);
      }
    } catch (e: any) {
      console.error("분석 오류:", e);
      setError(e.message || "❌ 분석 중 알 수 없는 오류가 발생했습니다.\n\n💡 해결 방법:\n• 페이지를 새로고침하고 다시 시도해주세요\n• 문제가 지속되면 개발자에게 문의해주세요");
    } finally {
      setIsAnalyzing(false);
    }
  }, [transcript, selectedCategory, videoDetails, apiKey, appliedIdeaKeyword]);

  const handleRefreshIdeas = useCallback(async () => {
    if (!analysisResult || !apiKey) return;
    setIsGeneratingIdeas(true);
    setError(null);
    try {
      const ideas = await generateIdeas(
        analysisResult,
        selectedCategory,
        apiKey,
        appliedIdeaKeyword || undefined
      );
      setSuggestedIdeas(ideas);
    } catch (e: any) {
      setError(e.message || "❌ 아이디어 재생성 중 알 수 없는 오류가 발생했습니다.\n\n💡 해결 방법:\n• 페이지를 새로고침하고 다시 시도해주세요");
    } finally {
      setIsGeneratingIdeas(false);
    }
  }, [analysisResult, selectedCategory, apiKey, appliedIdeaKeyword]);

  const handleApplyIdeaKeyword = useCallback(async () => {
    if (!analysisResult || !apiKey) return;
    setAppliedIdeaKeyword(userIdeaKeyword);
    setIsGeneratingIdeas(true);
    setError(null);
    try {
      const ideas = await generateIdeas(
        analysisResult,
        selectedCategory,
        apiKey,
        userIdeaKeyword || undefined
      );
      setSuggestedIdeas(ideas);
    } catch (e: any) {
      setError(e.message || "❌ 아이디어 생성 중 알 수 없는 오류가 발생했습니다.\n\n💡 해결 방법:\n• 페이지를 새로고침하고 다시 시도해주세요");
    } finally {
      setIsGeneratingIdeas(false);
    }
  }, [analysisResult, selectedCategory, apiKey, userIdeaKeyword]);

  const handleResetToAIRecommendation = useCallback(async () => {
    if (!analysisResult || !apiKey) return;
    setUserIdeaKeyword("");
    setAppliedIdeaKeyword("");
    setIsGeneratingIdeas(true);
    setError(null);
    try {
      const ideas = await generateIdeas(
        analysisResult,
        selectedCategory,
        apiKey,
        undefined
      );
      setSuggestedIdeas(ideas);
    } catch (e: any) {
      setError(e.message || "❌ 아이디어 재생성 중 알 수 없는 오류가 발생했습니다.\n\n💡 해결 방법:\n• 페이지를 새로고침하고 다시 시도해주세요");
    } finally {
      setIsGeneratingIdeas(false);
    }
  }, [analysisResult, selectedCategory, apiKey]);

  const handleGenerate = useCallback(async () => {
    if (!apiKey) {
      setShowApiKeyModal(true);
      setError("API 키를 먼저 설정해주세요.");
      return;
    }
    if (!analysisResult || !newKeyword) {
      setError("분석 결과와 새로운 키워드가 모두 필요합니다.");
      return;
    }
    setIsGenerating(true);
    setError(null);
    setNewPlan(null);

    try {
      // 영상 길이를 분 단위로 변환하여 챕터 시스템 필요 여부 판단
      const parseMinutes = (lengthStr: string): number => {
        let totalMinutes = 0;
        const hourMatch = lengthStr.match(/(\d+)\s*시간/);
        const minuteMatch = lengthStr.match(/(\d+)\s*분/);
        
        if (hourMatch) totalMinutes += parseInt(hourMatch[1]) * 60;
        if (minuteMatch) totalMinutes += parseInt(minuteMatch[1]);
        
        // 숫자만 있으면 분으로 간주
        if (!hourMatch && !minuteMatch) {
          const numMatch = lengthStr.match(/(\d+)/);
          if (numMatch) totalMinutes = parseInt(numMatch[1]);
        }
        
        return totalMinutes;
      };
      
      const totalMinutes = parseMinutes(customLength);
      
      // 모든 영상에 챕터 시스템 사용 (대본 길이 2배 증가로 인해)
      // 8분 영상도 챕터 2개로 시작
      const needsChapterSystem = true;
      
      if (needsChapterSystem) {
        // 챕터 개요만 생성 (대본은 사용자가 순차적으로 생성)
        const chapterOutline = await generateChapterOutline(
          analysisResult,
          newKeyword,
          customLength,
          selectedCategory,
          apiKey,
          selectedCategory === "브이로그" ? selectedVlogType : undefined,
          scriptStyle
        );
        
        setNewPlan({
          newIntent: chapterOutline.newIntent,
          characters: chapterOutline.characters,
          chapters: chapterOutline.chapters,
        });
      } else {
        // 20분 미만 영상은 한 번에 생성 (챕터 시스템 불필요)
        const result = await generateNewPlan(
          analysisResult,
          newKeyword,
          customLength,
          selectedCategory,
          apiKey,
          selectedCategory === "브이로그" ? selectedVlogType : undefined
        );
        setNewPlan(result);
      }
    } catch (e: any) {
      console.error("기획안 생성 오류:", e);
      
      // 상세한 오류 정보 수집
      const errorDetails = {
        message: e.message || "알 수 없는 오류",
        stack: e.stack || "스택 정보 없음",
        timestamp: new Date().toISOString(),
        category: selectedCategory,
        length: customLength,
        keyword: newKeyword,
        hasApiKey: !!apiKey,
        hasAnalysisResult: !!analysisResult,
      };
      
      console.error("상세 오류 정보:", errorDetails);
      
      // 사용자 친화적인 오류 메시지 생성
      let userMessage = "🚨 기획안 생성 실패\n\n";
      userMessage += "━━━━━━━━━━━━━━━━━━━━━━\n\n";
      
      // 오류 원인 분석
      userMessage += "📋 오류 원인:\n";
      if (e.message?.includes("API_KEY") || e.message?.includes("api key") || e.message?.includes("401")) {
        userMessage += "• API 키가 유효하지 않거나 만료되었습니다\n\n";
      } else if (e.message?.includes("quota") || e.message?.includes("limit")) {
        userMessage += "• API 사용량 한도를 초과했습니다\n\n";
      } else if (e.message?.includes("network") || e.message?.includes("fetch")) {
        userMessage += "• 네트워크 연결에 문제가 있습니다\n\n";
      } else if (e.message?.includes("timeout")) {
        userMessage += "• 요청 시간이 초과되었습니다\n\n";
      } else {
        userMessage += `• ${e.message || "알 수 없는 오류가 발생했습니다"}\n\n`;
      }
      
      // 사용자 해결 방법
      userMessage += "💡 해결 방법:\n";
      userMessage += "1. 페이지를 새로고침(F5)하고 다시 시도해주세요\n";
      userMessage += "2. API 키가 올바르게 설정되었는지 확인해주세요\n";
      userMessage += "3. 인터넷 연결 상태를 확인해주세요\n";
      userMessage += "4. 브라우저 캐시를 지우고 다시 시도해주세요\n";
      userMessage += "5. 잠시 후 다시 시도해주세요 (서버 과부하 가능성)\n\n";
      
      // 개발자 전달 정보
      userMessage += "🔧 개발자에게 전달할 정보:\n";
      userMessage += `• 오류 시각: ${new Date().toLocaleString("ko-KR")}\n`;
      userMessage += `• 카테고리: ${selectedCategory}\n`;
      userMessage += `• 영상 길이: ${customLength}\n`;
      userMessage += `• 키워드: ${newKeyword}\n`;
      userMessage += `• 오류 메시지: ${e.message || "없음"}\n`;
      userMessage += `• 브라우저: ${navigator.userAgent}\n\n`;
      
      userMessage += "━━━━━━━━━━━━━━━━━━━━━━\n";
      userMessage += "문제가 계속되면 위 정보를 개발자에게 전달해주세요.";
      
      setError(userMessage);
      
      // 오류 로그를 localStorage에 저장 (디버깅용)
      try {
        const errorLog = JSON.parse(localStorage.getItem("errorLog") || "[]");
        errorLog.push({
          ...errorDetails,
          userAgent: navigator.userAgent,
        });
        // 최근 10개만 보관
        if (errorLog.length > 10) errorLog.shift();
        localStorage.setItem("errorLog", JSON.stringify(errorLog));
      } catch (logError) {
        console.error("오류 로그 저장 실패:", logError);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [analysisResult, newKeyword, customLength, selectedCategory, apiKey, selectedVlogType, scriptStyle]);

  // 챕터별 대본 생성 핸들러
  const handleGenerateChapterScript = useCallback(async (chapterId: string) => {
    if (!apiKey || !newPlan || !newPlan.chapters || !newPlan.characters) {
      const errorMsg = "챕터 대본 생성에 필요한 정보가 없습니다.";
      setError(errorMsg);
      alert(errorMsg);
      return;
    }

    const chapterIndex = newPlan.chapters.findIndex(ch => ch.id === chapterId);
    if (chapterIndex === -1) {
      alert("챕터를 찾을 수 없습니다.");
      return;
    }

    // 이미 생성 중이면 무시
    if (newPlan.chapters[chapterIndex].isGenerating) {
      alert("이미 생성 중입니다. 잠시만 기다려주세요.");
      return;
    }

    // 챕터 생성 중 상태 업데이트
    setNewPlan(prev => {
      if (!prev || !prev.chapters) return prev;
      const updatedChapters = [...prev.chapters];
      updatedChapters[chapterIndex] = {
        ...updatedChapters[chapterIndex],
        isGenerating: true,
      };
      return { ...prev, chapters: updatedChapters };
    });

    // 타임아웃 설정 (3분)
    const timeoutId = setTimeout(() => {
      setNewPlan(prev => {
        if (!prev || !prev.chapters) return prev;
        const updatedChapters = [...prev.chapters];
        if (updatedChapters[chapterIndex].isGenerating) {
          updatedChapters[chapterIndex] = {
            ...updatedChapters[chapterIndex],
            isGenerating: false,
          };
          const errorMsg = `🚨 챕터 ${chapterIndex + 1} 생성 시간 초과\n\n타임아웃이 발생했습니다. 다시 시도해주세요.\n\n문제가 지속되면:\n1. 페이지를 새로고침해주세요\n2. 영상 길이를 짧게 설정해보세요\n3. 잠시 후 다시 시도해주세요`;
          setError(errorMsg);
          alert(errorMsg);
        }
        return { ...prev, chapters: updatedChapters };
      });
    }, 180000); // 3분

    try {
      console.log(`챕터 ${chapterIndex + 1} 생성 시작...`);
      
      const script = await generateChapterScript(
        newPlan.chapters[chapterIndex],
        newPlan.characters,
        newKeyword,
        selectedCategory,
        apiKey,
        newPlan.chapters,
        scriptStyle
      );

      clearTimeout(timeoutId);
      console.log(`챕터 ${chapterIndex + 1} 생성 완료!`);

      // 생성된 대본 저장
      setNewPlan(prev => {
        if (!prev || !prev.chapters) return prev;
        const updatedChapters = [...prev.chapters];
        updatedChapters[chapterIndex] = {
          ...updatedChapters[chapterIndex],
          script,
          isGenerating: false,
        };
        return { ...prev, chapters: updatedChapters };
      });

      // 성공 알림
      alert(`✅ 챕터 ${chapterIndex + 1} 생성 완료!`);

    } catch (e: any) {
      clearTimeout(timeoutId);
      console.error(`챕터 ${chapterIndex + 1} 생성 오류:`, e);
      
      // 상세한 오류 정보
      const errorDetails = {
        chapterIndex: chapterIndex + 1,
        chapterTitle: newPlan.chapters[chapterIndex].title,
        message: e.message || "알 수 없는 오류",
        timestamp: new Date().toISOString(),
        category: selectedCategory,
        keyword: newKeyword,
      };
      
      console.error("상세 오류 정보:", errorDetails);
      
      // 사용자 친화적인 오류 메시지
      let userMessage = `🚨 챕터 ${chapterIndex + 1} 생성 실패\n\n`;
      userMessage += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      userMessage += `챕터 제목: ${newPlan.chapters[chapterIndex].title}\n\n`;
      
      // 오류 원인 분석
      userMessage += "📋 오류 원인:\n";
      if (e.message?.includes("API_KEY") || e.message?.includes("api key") || e.message?.includes("401")) {
        userMessage += "• API 키가 유효하지 않거나 만료되었습니다\n\n";
      } else if (e.message?.includes("quota") || e.message?.includes("limit")) {
        userMessage += "• API 사용량 한도를 초과했습니다\n\n";
      } else if (e.message?.includes("network") || e.message?.includes("fetch")) {
        userMessage += "• 네트워크 연결에 문제가 있습니다\n\n";
      } else if (e.message?.includes("timeout")) {
        userMessage += "• 요청 시간이 초과되었습니다\n\n";
      } else {
        userMessage += `• ${e.message || "알 수 없는 오류가 발생했습니다"}\n\n`;
      }
      
      // 해결 방법
      userMessage += "💡 해결 방법:\n";
      userMessage += "1. 페이지를 새로고침하고 다시 시도해주세요\n";
      userMessage += "2. API 키를 확인해주세요\n";
      userMessage += "3. 인터넷 연결을 확인해주세요\n";
      userMessage += "4. 다른 챕터부터 생성해보세요\n";
      userMessage += "5. 영상 길이를 짧게 설정해보세요\n\n";
      
      userMessage += `🔧 개발자 전달 정보:\n`;
      userMessage += `• 챕터 번호: ${chapterIndex + 1}\n`;
      userMessage += `• 오류 시각: ${new Date().toLocaleString("ko-KR")}\n`;
      userMessage += `• 오류 메시지: ${e.message || "없음"}\n\n`;
      
      userMessage += "━━━━━━━━━━━━━━━━━━━━━━\n";
      userMessage += "이 챕터를 건너뛰고 다음 챕터를 생성할 수 있습니다.";
      
      setError(userMessage);
      alert(userMessage);
      
      // 생성 실패 시 상태 복원
      setNewPlan(prev => {
        if (!prev || !prev.chapters) return prev;
        const updatedChapters = [...prev.chapters];
        updatedChapters[chapterIndex] = {
          ...updatedChapters[chapterIndex],
          isGenerating: false,
        };
        return { ...prev, chapters: updatedChapters };
      });
    }
  }, [apiKey, newPlan, newKeyword, selectedCategory, scriptStyle]);

  // --- Text Formatting Helpers for Download ---
  const formatKeywordsToText = (keywords: string[]): string =>
    keywords.join(", ");

  const formatStructuredContentToText = (
    content: StructuredContent[]
  ): string => {
    return content
      .map(
        (item) => `[${item.title}]\n${item.description.replace(/\*\*/g, "")}`
      )
      .join("\n\n---\n\n");
  };

  const formatScriptStructureToText = (stages: ScriptStage[]): string => {
    return stages
      .map(
        (stage) =>
          `[${stage.stage}]\n` +
          `목적: ${stage.purpose}\n\n` +
          `주요 인용구:\n${stage.quotes
            .map((q) => `[${q.timestamp}] "${q.text}"`)
            .join("\n")}`
      )
      .join("\n\n---\n\n");
  };

  const formatOutlineToText = (stages: OutlineStage[]): string => {
    return stages
      .map(
        (stage) =>
          `[${stage.stage}]\n` +
          `목적: ${stage.purpose}\n\n` +
          `상세 내용:\n${stage.details.replace(/\*\*/g, "")}`
      )
      .join("\n\n---\n\n");
  };

  const formatScriptWithCharactersToText = (
    script: { character: string; line: string }[]
  ): string => {
    return script.map((item) => `${item.character}: ${item.line}`).join("\n");
  };

  // 챕터별 대본 다운로드 포맷
  const formatChapterScriptToText = (
    chapter: { title: string; script?: { character: string; line: string; timestamp?: string }[] }
  ): string => {
    if (!chapter.script) return "";
    
    let text = `${chapter.title}\n${"=".repeat(50)}\n\n`;
    chapter.script.forEach((item) => {
      if (item.timestamp) {
        text += `[${item.timestamp}] ${item.character}: ${item.line}\n\n`;
      } else {
        text += `${item.character}: ${item.line}\n\n`;
      }
    });
    return text;
  };

  // 전체 챕터 대본 다운로드 포맷
  const formatAllChaptersToText = (chapters: any[]): string => {
    return chapters
      .filter((chapter) => chapter.script)
      .map((chapter, index) => {
        let text = `챕터 ${index + 1}: ${chapter.title}\n${"=".repeat(50)}\n\n`;
        chapter.script.forEach((item: any) => {
          if (item.timestamp) {
            text += `[${item.timestamp}] ${item.character}: ${item.line}\n\n`;
          } else {
            text += `${item.character}: ${item.line}\n\n`;
          }
        });
        return text;
      })
      .join("\n\n" + "=".repeat(50) + "\n\n");
  };

  // 전체 챕터 이미지 프롬프트 다운로드 포맷
  const formatAllImagePromptsToText = (chapters: any[]): string => {
    if (!chapters || chapters.length === 0) {
      return "챕터가 없습니다.";
    }
    
    const chaptersWithScript = chapters.filter((chapter) => chapter.script);
    
    if (chaptersWithScript.length === 0) {
      return "생성된 대본이 없습니다.";
    }
    
    const result = chaptersWithScript
      .map((chapter, index) => {
        let text = `챕터 ${index + 1}: ${chapter.title}\n${"=".repeat(50)}\n\n`;
        let hasPrompts = false;
        
        chapter.script.forEach((item: any, idx: number) => {
          if (item.imagePrompt && item.imagePrompt.trim() !== "") {
            text += `[${idx + 1}] ${item.imagePrompt}\n\n`;
            hasPrompts = true;
          }
        });
        
        if (!hasPrompts) {
          text += "이미지 프롬프트가 없습니다.\n\n";
        }
        
        return text;
      })
      .join("\n\n" + "=".repeat(50) + "\n\n");
      
    return result || "이미지 프롬프트가 없습니다.";
  };

  const handleSendToImageGenerator = () => {
    let scriptText = "";

    if (newPlan?.chapters?.length) {
      scriptText = formatAllChaptersToText(newPlan.chapters);
    } else if (newPlan?.scriptWithCharacters?.length) {
      scriptText = formatScriptWithCharactersToText(newPlan.scriptWithCharacters);
    } else if (transcript) {
      scriptText = transcript;
    }

    if (!scriptText.trim()) {
      alert("이미지 생성기로 보낼 대본이 없습니다. 대본을 생성한 뒤 다시 시도해주세요.");
      return;
    }

    navigate("/image", { state: { script: scriptText } });
  };

  const handleFetchTranscript = async () => {
    if (!youtubeUrl.trim()) {
      alert("유튜브 URL을 입력해주세요.");
      return;
    }
    setIsFetchingTranscript(true);
    try {
      const result = await fetchTranscript(youtubeUrl.trim());
      setTranscript(result.text.trim());
    } catch (error: any) {
      console.error("Transcript fetch failed:", error);
      alert(error?.message || "대본을 불러오지 못했습니다. 수동으로 입력해주세요.");
    } finally {
      setIsFetchingTranscript(false);
    }
  };

  const ideasTitle =
    selectedCategory === "쇼핑 리뷰"
      ? "리뷰할 제품 추천"
      : "새로운 아이디어 제안";
  const newKeywordPlaceholder =
    selectedCategory === "쇼핑 리뷰"
      ? "리뷰할 제품명 입력"
      : "떡상할 제목을 입력하세요";

  return (
    <div className="min-h-screen bg-[#121212] text-white font-sans p-4 sm:p-8 pb-32">
      {/* 애드블럭 감지 */}
      <AdBlockDetector onAdBlockDetected={handleAdBlockDetected} />

      {/* 애드블럭 경고 모달 */}
      <AdBlockWarningModal isOpen={adBlockDetected} />

      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onSave={handleSaveApiKey}
        currentApiKey={apiKey}
      />

      {/* 애드블럭 감지 시 컨텐츠 흐림 처리 */}
      <div
        className={`max-w-4xl mx-auto ${
          adBlockDetected ? "filter blur-sm pointer-events-none" : ""
        }`}
      >
        <header className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold bg-gradient-to-r from-[#FF0000] to-[#FF2B2B] bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(255,0,0,0.6)] mb-4">
            유튜브 떡상 대본의 비밀 파헤치기+모방
          </h1>
          <p className="text-neutral-300 mb-4">
            당신만 "이것"을 모릅니다. 떡상 비밀 파헤치고, 나만의 새로운 대본을
            1분만에 작성해보세요!
          </p>
          <nav className="flex justify-center gap-3 flex-wrap">
            <a
              href="/guide"
              className="px-4 py-2 bg-gradient-to-br from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white rounded-lg transition-all border border-purple-500/50 text-sm font-medium shadow-lg shadow-purple-500/30"
            >
              📖 사용법
            </a>
            <a
              href="/api-guide"
              className="px-4 py-2 bg-gradient-to-br from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white rounded-lg transition-all border border-blue-500/50 text-sm font-medium shadow-lg shadow-blue-500/30"
            >
              🗝️ API 키 발급 방법
            </a>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowApiKeyModal(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium shadow-lg ${
                  apiKey
                    ? "bg-gradient-to-br from-green-600 to-green-800 hover:from-green-500 hover:to-green-700 border border-green-500/50 shadow-green-500/30"
                    : "bg-gradient-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 border border-red-500/50 shadow-red-500/30 animate-pulse"
                } text-white`}
              >
                {apiKey ? (
                  <>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      <span>⚙️ API 키 설정됨</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                      <span>⚙️ API 키 입력 필요</span>
                    </span>
                  </>
                )}
              </button>
              {apiKey && (
                <button
                  onClick={handleDeleteApiKey}
                  className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-lg"
                  title="API 키 삭제"
                >
                  <FiTrash2 size={16} />
                </button>
              )}
              {(analysisResult || newPlan || suggestedIdeas.length > 0) && (
                <button
                  onClick={handleClearData}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors shadow-lg text-sm font-medium"
                  title="저장된 분석 결과 및 기획안 삭제"
                >
                  <FiTrash2 size={14} />
                  <span>데이터 초기화</span>
                </button>
              )}
            </div>
          </nav>

          {!apiKey && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-center">
              <p className="text-red-300 text-sm font-medium">
                ⚠️ AI 분석 기능을 사용하려면 먼저{" "}
                <span className="font-bold text-red-200">API 키를 입력</span>
                해주세요!
              </p>
            </div>
          )}
        </header>

        <main>
          {/* --- INPUT SECTION --- */}
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-6 mb-8">
            <div className="mb-6">
              <label
                htmlFor="youtube-url"
                className="block text-2xl font-bold text-neutral-100 mb-3"
              >
                유튜브 URL 입력
              </label>
              {!videoDetails ? (
                <div className="relative mt-1 youtube-url-input">
                  <input
                    type="text"
                    id="youtube-url"
                    value={youtubeUrl}
                    onChange={handleUrlChange}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full bg-[#121212] border border-[#2A2A2A] rounded-md p-2 text-neutral-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition"
                    style={
                      {
                        userSelect: "text",
                        WebkitUserSelect: "text",
                      } as React.CSSProperties
                    }
                  />
                  <button
                    onClick={handleFetchTranscript}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs font-semibold rounded-md bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isFetchingTranscript}
                  >
                    {isFetchingTranscript ? "불러오는 중..." : "대본 자동 입력"}
                  </button>
                  {isFetchingDetails && (
                    <div className="absolute inset-y-0 right-28 flex items-center pr-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-500"></div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative group mt-2">
                  <div className="border border-[#2A2A2A] rounded-lg overflow-hidden bg-zinc-900/50 focus-within:ring-2 focus-within:ring-red-500">
                    <a
                      href={youtubeUrl}
                      className="block hover:opacity-90 transition-opacity focus:outline-none"
                    >
                      <img
                        src={videoDetails.thumbnailUrl}
                        alt="YouTube Video Thumbnail"
                        className="w-full object-cover aspect-video"
                      />
                      <div className="p-4 border-t border-[#2A2A2A]">
                        <p
                          className="font-semibold text-white mb-1 truncate"
                          title={videoDetails.title}
                        >
                          {videoDetails.title}
                        </p>
                        <p className="text-xs text-neutral-400">
                          www.youtube.com
                        </p>
                      </div>
                    </a>
                    <button
                      onClick={handleRemoveUrl}
                      className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      aria-label="링크 제거"
                      title="링크 제거"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-2xl font-bold text-neutral-100">
                  카테고리 선택
                  <span className="text-sm font-normal text-neutral-400 ml-2">
                    (드래그하여 순서 변경)
                  </span>
                </label>
                <button
                  onClick={() => {
                    setCategories(defaultCategories);
                    localStorage.setItem("categoriesOrder", JSON.stringify(defaultCategories));
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-zinc-700 hover:bg-zinc-600 text-neutral-200 rounded-md transition-all duration-200 flex items-center gap-1"
                  title="기본 순서로 초기화"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                      clipRule="evenodd"
                    />
                  </svg>
                  순서 초기화
                </button>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={categories}
                  strategy={horizontalListSortingStrategy}
                >
                  <div className="flex flex-wrap gap-2">
                    {categories.map((category) => (
                      <SortableItem
                        key={category}
                        id={category}
                        category={category}
                        isSelected={selectedCategory === category}
                        onClick={() => setSelectedCategory(category)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            {/* 브이로그 서브타입 선택 */}
            {selectedCategory === "브이로그" && (
              <div className="mb-6">
                <label className="block text-xl font-bold text-neutral-100 mb-3">
                  브이로그 타입
                </label>
                <div className="flex flex-wrap gap-2">
                  {vlogTypes.map((vlogType) => (
                    <button
                      key={vlogType}
                      onClick={() => setSelectedVlogType(vlogType)}
                      className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                        selectedVlogType === vlogType
                          ? "bg-gradient-to-br from-[#D90000] to-[#FF2B2B] text-white shadow-[0_0_10px_rgba(255,43,43,0.5)]"
                          : "bg-[#2A2A2A] hover:bg-zinc-700 text-neutral-200"
                      }`}
                    >
                      {vlogType}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label
                  htmlFor="transcript"
                  className="block text-2xl font-bold text-neutral-100"
                >
                  대본 입력
                </label>
                <div className="flex gap-2">
                  {contentTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => setContentType(type)}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-all duration-200 ${
                        contentType === type
                          ? "bg-gradient-to-br from-[#D90000] to-[#FF2B2B] text-white"
                          : "bg-[#2A2A2A] hover:bg-zinc-700 text-neutral-200"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="transcript-input">
                <textarea
                  id="transcript"
                  rows={10}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="여기에 스크립트를 붙여넣어 주세요."
                  className="w-full bg-[#121212] border border-[#2A2A2A] rounded-md p-2 text-neutral-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition"
                  style={
                    {
                      userSelect: "text",
                      WebkitUserSelect: "text",
                    } as React.CSSProperties
                  }
                />
                {error && (
                  <div className="bg-red-900/50 border-2 border-red-500 text-red-100 p-5 rounded-xl mt-3 shadow-[0_0_20px_rgba(220,38,38,0.3)]">
                    <div className="flex items-center gap-2 font-bold text-xl mb-3">
                      <span className="text-2xl">🚨</span>
                      <span>오류 발생</span>
                    </div>
                    <div className="bg-red-950/80 rounded-lg p-4 mb-3">
                      <pre className="whitespace-pre-wrap overflow-auto max-h-96 font-mono text-sm text-red-200 leading-relaxed">
                        {error}
                      </pre>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(error);
                        alert("오류 메시지가 복사되었습니다. 개발자에게 전달해주세요.");
                      }}
                      className="w-full bg-red-700 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      오류 메시지 복사하기
                    </button>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !transcript}
              className="w-full mt-4 bg-gradient-to-br from-[#D90000] to-[#FF2B2B] text-white font-bold py-3 px-4 rounded-lg hover:from-[#D90000]/90 hover:to-[#FF2B2B]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
            >
              {isAnalyzing ? "분석 중..." : "떡상 이유 분석하기"}
            </button>

            {/* 분석 진행 상태 표시 */}
            {isAnalyzing && (
              <div className="mt-4 bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] border border-[#3a3a3a] rounded-lg p-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF2B2B]"></div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${isAnalyzing ? 'bg-[#FF2B2B] animate-pulse' : 'bg-gray-600'}`}></div>
                    <span className="text-sm text-neutral-300">
                      {isGeneratingIdeas ? '✓ 스크립트 분석 완료' : '📊 스크립트 분석 중...'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${isGeneratingIdeas ? 'bg-[#FF2B2B] animate-pulse' : 'bg-gray-600'}`}></div>
                    <span className={`text-sm ${isGeneratingIdeas ? 'text-neutral-300' : 'text-gray-500'}`}>
                      {isGeneratingIdeas ? '💡 새로운 아이디어 생성 중...' : '새로운 아이디어 대기 중'}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-neutral-500 text-center mt-4">
                  분석에는 약 10-30초 정도 소요됩니다
                </p>
              </div>
            )}
          </div>

          <AdSense />

          {/* --- SEPARATOR --- */}
          <div className="my-12">
            <div className="relative">
              <div
                className="absolute inset-0 flex items-center"
                aria-hidden="true"
              >
                <div className="w-full border-t border-[#2A2A2A]"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[#121212] px-4 text-sm font-semibold text-neutral-400">
                  결과 및 기획안
                </span>
              </div>
            </div>
          </div>

          {/* --- ANALYSIS RESULTS SECTION --- */}
          <div id="analysis-results" className="mb-12">
            <h2 className="text-3xl font-bold text-center mb-6 text-white">
              영상 분석 결과
            </h2>
            {isAnalyzing ? (
              <Loader />
            ) : analysisResult ? (
              <>
                <ResultCard
                  title="1. 영상의 핵심 키워드"
                  contentToCopy={formatKeywordsToText(analysisResult.keywords)}
                  downloadFileName="keywords-analysis"
                >
                  <div className="flex flex-wrap">
                    {analysisResult.keywords.map((kw, i) => (
                      <KeywordPill key={i} keyword={kw} />
                    ))}
                  </div>
                </ResultCard>

                <ResultCard
                  title="2. 기획 의도"
                  contentToCopy={formatStructuredContentToText(
                    analysisResult.intent
                  )}
                  downloadFileName="intent-analysis"
                >
                  <div className="space-y-6">
                    {analysisResult.intent.map((item, index) => (
                      <div
                        key={index}
                        className="bg-zinc-900 p-4 rounded-lg border border-[#2A2A2A]"
                      >
                        <h3 className="font-bold text-red-500 mb-2">
                          {item.title}
                        </h3>
                        <div
                          className="prose prose-invert max-w-none prose-p:text-white prose-strong:text-red-500"
                          dangerouslySetInnerHTML={{
                            __html: highlightImportantText(
                              item.description.replace(/\*\*/g, "")
                            ),
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </ResultCard>

                <AdSense />

                <ResultCard
                  title="3. 조회수 예측 분석"
                  contentToCopy={formatStructuredContentToText(
                    analysisResult.viewPrediction
                  )}
                  downloadFileName="view-prediction-analysis"
                >
                  <div className="space-y-6">
                    {analysisResult.viewPrediction.map((item, index) => (
                      <div
                        key={index}
                        className="bg-zinc-900 p-4 rounded-lg border border-[#2A2A2A]"
                      >
                        <h3 className="font-bold text-red-500 mb-2">
                          {item.title}
                        </h3>
                        <div
                          className="prose prose-invert max-w-none prose-p:text-white prose-strong:text-red-500"
                          dangerouslySetInnerHTML={{
                            __html: highlightImportantText(
                              item.description.replace(/\*\*/g, "")
                            ),
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </ResultCard>

                <AdSense />

                {analysisResult.scriptStructure && (
                  <ResultCard
                    title="4. 대본 구조 분석"
                    contentToCopy={formatScriptStructureToText(
                      analysisResult.scriptStructure
                    )}
                    downloadFileName="script-structure-analysis"
                  >
                    <div className="space-y-6">
                      {analysisResult.scriptStructure.map(
                        (stage: ScriptStage, index: number) => (
                          <div
                            key={index}
                            className="bg-zinc-900 p-4 rounded-lg border border-[#2A2A2A]"
                          >
                            <h3 className="font-bold text-lg text-red-500 mb-3">
                              {stage.stage}
                            </h3>
                            <div
                              className="prose prose-invert max-w-none prose-p:text-white prose-strong:text-red-500 mb-4"
                              dangerouslySetInnerHTML={{
                                __html: highlightImportantText(
                                  stage.purpose.replace(/\*\*/g, "")
                                ),
                              }}
                            />
                            <ul className="space-y-3 text-white">
                              {stage.quotes.map(
                                (quote: ScriptQuote, qIndex: number) => (
                                  <li
                                    key={qIndex}
                                    className="text-base flex items-start"
                                  >
                                    <span className="font-mono text-red-500 mr-3 w-16 text-right flex-shrink-0">
                                      [{quote.timestamp}]
                                    </span>
                                    <span>"{quote.text}"</span>
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        )
                      )}
                    </div>
                  </ResultCard>
                )}
              </>
            ) : (
              <div className="bg-[#1A1A1A] border-2 border-dashed border-[#2A2A2A] rounded-xl p-8 text-center text-neutral-400">
                <p className="text-lg font-semibold">
                  분석 결과가 여기에 표시됩니다
                </p>
                <p className="mt-2 text-sm">
                  스크립트를 입력하고 분석 버튼을 눌러주세요.
                </p>
              </div>
            )}
          </div>

          <AdSense />

          {/* --- NEW PLAN GENERATION SECTION --- */}
          <div id="generation-section" className="mb-8">
            <h2 className="text-3xl font-bold text-center mb-6 text-white">
              나만의 떡상 대본 작성
            </h2>
            <div
              className={`bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-6 space-y-6 transition-opacity ${
                !analysisResult && "opacity-50 pointer-events-none"
              }`}
            >
              <div>
                <label className="block text-xl font-bold text-neutral-100 mb-3">
                  예상 영상 길이
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {lengthOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        setLengthMode(option);
                        setCustomLength(option);
                      }}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                        lengthMode === option
                          ? "bg-gradient-to-br from-[#D90000] to-[#FF2B2B] text-white shadow-[0_0_10px_rgba(255,43,43,0.5)]"
                          : "bg-[#2A2A2A] hover:bg-zinc-700 text-neutral-200"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                  <button
                    key="custom"
                    onClick={() => {
                      setLengthMode("custom");
                      setCustomLength("");
                    }}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                      lengthMode === "custom"
                        ? "bg-gradient-to-br from-[#D90000] to-[#FF2B2B] text-white shadow-[0_0_10px_rgba(255,43,43,0.5)]"
                        : "bg-[#2A2A2A] hover:bg-zinc-700 text-neutral-200"
                    }`}
                  >
                    사용자 입력
                  </button>
                </div>
                {lengthMode === "custom" && (
                  <div className="mt-3">
                    <input
                      id="video-length"
                      type="text"
                      value={customLength}
                      onChange={(e) => setCustomLength(e.target.value)}
                      placeholder="예: 1시간 30분, 45분, 2시간"
                      className="w-full bg-[#121212] border border-[#2A2A2A] rounded-md p-3 text-neutral-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition"
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* 이미지 프롬프트 옵션 */}
              <div>
                <label className="block text-xl font-bold text-neutral-100 mb-3">
                  대본 스타일
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setScriptStyle("대화 버전")}
                    className={`flex-1 px-4 py-3 text-sm font-medium rounded-md transition-all duration-200 ${
                      scriptStyle === "대화 버전"
                        ? "bg-gradient-to-br from-[#D90000] to-[#FF2B2B] text-white shadow-[0_0_10px_rgba(255,43,43,0.5)]"
                        : "bg-[#2A2A2A] hover:bg-zinc-700 text-neutral-200"
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-bold">💬 대화 버전</div>
                      <div className="text-xs mt-1 opacity-80">등장인물 간 대화 형식</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setScriptStyle("나레이션 버전")}
                    className={`flex-1 px-4 py-3 text-sm font-medium rounded-md transition-all duration-200 ${
                      scriptStyle === "나레이션 버전"
                        ? "bg-gradient-to-br from-[#D90000] to-[#FF2B2B] text-white shadow-[0_0_10px_rgba(255,43,43,0.5)]"
                        : "bg-[#2A2A2A] hover:bg-zinc-700 text-neutral-200"
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-bold">🎙️ 나레이션 버전</div>
                      <div className="text-xs mt-1 opacity-80">단독 나레이터 형식</div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xl font-bold text-neutral-100 mb-3">
                    {ideasTitle}
                  </label>
                  <button
                    onClick={handleRefreshIdeas}
                    disabled={isGeneratingIdeas || !analysisResult}
                    className="text-sm font-medium text-red-500 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    새로고침
                  </button>
                </div>
                <div className="mb-3 user-idea-keyword-input">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={userIdeaKeyword}
                      onChange={(e) => setUserIdeaKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && userIdeaKeyword.trim()) {
                          handleApplyIdeaKeyword();
                        }
                      }}
                      placeholder="원하는 키워드 입력 (선택사항) - 예: 다이어트, 여행, 게임"
                      className="flex-1 bg-[#121212] border border-[#2A2A2A] rounded-md p-2 text-sm text-neutral-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition new-idea-input"
                      style={
                        {
                          userSelect: "text",
                          WebkitUserSelect: "text",
                          MozUserSelect: "text",
                          msUserSelect: "text",
                          cursor: "text",
                          pointerEvents: "auto",
                        } as React.CSSProperties
                      }
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={handleApplyIdeaKeyword}
                      disabled={isGeneratingIdeas || !analysisResult || !userIdeaKeyword.trim()}
                      className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      적용
                    </button>
                    {appliedIdeaKeyword && (
                      <button
                        onClick={handleResetToAIRecommendation}
                        disabled={isGeneratingIdeas || !analysisResult}
                        className="px-4 py-2 text-sm font-medium bg-zinc-700 hover:bg-zinc-600 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        AI 추천으로
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">
                    💡 특정 키워드를 입력하고 '적용' 버튼을 누르면 해당 키워드를 포함한 아이디어가 생성됩니다.
                    {appliedIdeaKeyword && (
                      <span className="text-red-400 font-medium">
                        {" "}현재 적용된 키워드: "{appliedIdeaKeyword}"
                      </span>
                    )}
                  </p>
                </div>
                {isGeneratingIdeas ? (
                  <div className="flex justify-center items-center h-24 rounded-lg bg-zinc-900">
                    <Loader />
                  </div>
                ) : suggestedIdeas.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {suggestedIdeas.map((idea, index) => (
                      <button
                        key={index}
                        onClick={() => setNewKeyword(idea)}
                        className="bg-[#2A2A2A] hover:bg-zinc-700 text-neutral-200 text-left text-sm px-4 py-3 rounded-lg transition-colors"
                      >
                        {idea}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-4 rounded-lg bg-zinc-900 text-sm text-neutral-400">
                    {analysisResult
                      ? "새로운 아이디어를 생성 중이거나 생성할 수 없습니다."
                      : "영상을 분석하면 아이디어가 제안됩니다."}
                  </div>
                )}
              </div>

              <div className="new-title-input">
                <label
                  htmlFor="new-keyword"
                  className="block text-xl font-bold text-neutral-100 mb-3"
                >
                  새로운 떡상 제목 (직접 입력 또는 아이디어 선택)
                </label>
                <input
                  id="new-keyword"
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder={newKeywordPlaceholder}
                  className="w-full bg-[#121212] border border-[#2A2A2A] rounded-md p-3 text-neutral-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition"
                  style={
                    {
                      userSelect: "text",
                      WebkitUserSelect: "text",
                      MozUserSelect: "text",
                      msUserSelect: "text",
                      cursor: "text",
                      pointerEvents: "auto",
                    } as React.CSSProperties
                  }
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              {(!analysisResult || !newKeyword) && (
                <div className="mb-4 p-4 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
                  <p className="text-yellow-300 text-sm">
                    ⚠️ {!analysisResult ? "먼저 영상을 분석해주세요." : "새로운 떡상 제목을 입력해주세요."}
                  </p>
                </div>
              )}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !newKeyword || !analysisResult}
                className="w-full bg-gradient-to-br from-[#D90000] to-[#FF2B2B] text-white font-bold py-3 px-6 rounded-lg hover:from-[#D90000]/90 hover:to-[#FF2B2B]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
              >
                {isGenerating ? "생성 중..." : "기획안 생성"}
              </button>

              {/* 기획안 생성 오류 표시 */}
              {error && !isAnalyzing && !isGenerating && (
                <div className="mt-4 bg-red-900/50 border-2 border-red-500 text-red-100 p-5 rounded-xl shadow-[0_0_20px_rgba(220,38,38,0.3)]">
                  <div className="flex items-center gap-2 font-bold text-xl mb-3">
                    <span className="text-2xl">🚨</span>
                    <span>기획안 생성 실패</span>
                  </div>
                  <div className="bg-red-950/80 rounded-lg p-4 mb-3">
                    <pre className="whitespace-pre-wrap overflow-auto max-h-96 font-mono text-sm text-red-200 leading-relaxed">
                      {error}
                    </pre>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(error);
                        alert("오류 메시지가 복사되었습니다. 개발자에게 전달해주세요.");
                      }}
                      className="flex-1 bg-red-700 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      오류 복사
                    </button>
                    <button
                      onClick={() => setError(null)}
                      className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                    >
                      닫기
                    </button>
                  </div>
                </div>
              )}

              {/* 기획안 생성 진행 상태 표시 */}
              {isGenerating && (
                <div className="mt-4 bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] border border-[#3a3a3a] rounded-lg p-6">
                  <div className="flex items-center justify-center mb-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF2B2B]"></div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-[#FF2B2B] animate-pulse"></div>
                      <span className="text-sm text-neutral-300">
                        📝 새로운 영상 기획 의도 생성 중...
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-[#FF2B2B] animate-pulse"></div>
                      <span className="text-sm text-neutral-300">
                        🎬 대본 구조 설계 중...
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-[#FF2B2B] animate-pulse"></div>
                      <span className="text-sm text-neutral-300">
                        ✍️ 완성된 대본 작성 중...
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-500 text-center mt-4">
                    생성에는 약 30-60초 정도 소요됩니다
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* --- NEW PLAN RESULTS SECTION --- */}
          <div id="new-plan-results">
            {isGenerating ? (
              <Loader />
            ) : newPlan ? (
              <>
                <AdSense />

                <ResultCard
                  title="5. 새로운 영상 기획 의도"
                  contentToCopy={formatStructuredContentToText(
                    newPlan.newIntent
                  )}
                  downloadFileName="new-plan-intent"
                >
                  <div className="space-y-6">
                    {newPlan.newIntent.map((item, index) => (
                      <div
                        key={index}
                        className="bg-zinc-900 p-4 rounded-lg border border-[#2A2A2A]"
                      >
                        <h3 className="font-bold text-red-500 mb-2">
                          {item.title}
                        </h3>
                        <div
                          className="prose prose-invert max-w-none prose-p:text-white prose-strong:text-red-500"
                          dangerouslySetInnerHTML={{
                            __html: highlightImportantText(
                              item.description.replace(/\*\*/g, "")
                            ),
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </ResultCard>

                <AdSense />

                {/* 챕터 기반 대본 (1시간 영상) */}
                {newPlan.chapters && newPlan.characters && (
                  <ResultCard
                    title="6. 생성된 대본"
                    contentToCopy={formatAllChaptersToText(newPlan.chapters)}
                    downloadFileName="chapter-scripts"
                    imagePrompts={(() => {
                      const prompts = formatAllImagePromptsToText(newPlan.chapters);
                      console.log("ImagePrompts for download:", prompts);
                      return prompts;
                    })()}
                  >
                    <div className="flex justify-end mb-4">
                      <button
                        onClick={handleSendToImageGenerator}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold shadow-md hover:from-purple-500 hover:to-indigo-500 transition"
                      >
                        🎨 이미지 생성기로 보내기
                      </button>
                    </div>
                    <div className="space-y-8">
                      {/* 1. 등장인물 */}
                      <div>
                        <h3 className="text-2xl font-bold text-red-500 mb-4">
                          등장인물
                        </h3>
                        <div className="flex flex-wrap gap-3 p-5 bg-zinc-900 rounded-lg border border-[#2A2A2A]">
                          {newPlan.characters.map((character, index) => (
                            <span
                              key={index}
                              className={`font-semibold px-4 py-2 rounded-full text-sm ${characterColorMap
                                .get(character)
                                ?.replace(
                                  "text-",
                                  "bg-"
                                )}/20 ${characterColorMap.get(character)}`}
                            >
                              {character}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* 2. 각 챕터별 */}
                      <div>
                        <h3 className="text-2xl font-bold text-red-500 mb-4">
                          각 챕터별
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                          {newPlan.chapters.map((chapter, index) => {
                            const prevChapter = index > 0 ? newPlan.chapters[index - 1] : null;
                            const canGenerate = index === 0 || (prevChapter && prevChapter.script);
                            
                            return (
                              <button
                                key={chapter.id}
                                onClick={() => {
                                  if (canGenerate && !chapter.script && !chapter.isGenerating) {
                                    handleGenerateChapterScript(chapter.id);
                                  }
                                }}
                                disabled={!canGenerate || chapter.isGenerating}
                                className={`p-4 rounded-lg border-2 transition-all text-left ${
                                  chapter.script
                                    ? 'bg-green-900/20 border-green-500/50 cursor-default'
                                    : chapter.isGenerating
                                    ? 'bg-blue-900/20 border-blue-500/50 cursor-wait'
                                    : canGenerate
                                    ? 'bg-zinc-900 border-zinc-700 hover:border-blue-500 cursor-pointer'
                                    : 'bg-zinc-900/50 border-zinc-800 cursor-not-allowed opacity-50'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-lg font-bold text-white">
                                    {index + 1}
                                  </span>
                                  {chapter.script && (
                                    <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                  {chapter.isGenerating && (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                                  )}
                                </div>
                                <p className="text-sm text-neutral-300 line-clamp-2">
                                  {chapter.title}
                                </p>
                              </button>
                            );
                          })}
                        </div>

                        {/* 선택된 챕터 상세 정보 */}
                        <div className="space-y-4">
                          {newPlan.chapters.map((chapter, index) => {
                            if (!chapter.script) return null;
                            
                            return (
                              <div key={chapter.id} className="p-6 bg-zinc-900 rounded-lg border border-[#2A2A2A]">
                                <div className="flex items-start justify-between mb-4">
                                  <div>
                                    <h4 className="text-xl font-bold text-white mb-1">
                                      챕터 {index + 1}: {chapter.title}
                                    </h4>
                                    <p className="text-sm text-purple-400">
                                      예상 소요 시간: {chapter.estimatedDuration}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 px-3 py-1 bg-green-900/30 text-green-400 rounded-full border border-green-500/50 text-sm">
                                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    생성 완료
                                  </div>
                                </div>
                                <p className="text-neutral-300 mb-4 whitespace-pre-wrap">
                                  {chapter.purpose}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 3. 대본 내용 - 생성된 챕터만 표시 */}
                      {newPlan.chapters.some(ch => ch.script) && (
                        <div>
                          <h3 className="text-2xl font-bold text-red-500 mb-4">
                            대본 내용
                          </h3>
                          <div className="space-y-6">
                            {newPlan.chapters.map((chapter, index) => {
                              if (!chapter.script) return null;
                              
                              return (
                                <div key={chapter.id} className="p-6 bg-zinc-900 rounded-lg border border-[#2A2A2A]">
                                  <h4 className="text-lg font-bold text-cyan-400 mb-4">
                                    챕터 {index + 1}: {chapter.title}
                                  </h4>
                                  <div className="space-y-4 max-h-[500px] overflow-y-auto p-4 bg-black/30 rounded-lg">
                                    {chapter.script.map((item, scriptIndex) => (
                                      <div key={scriptIndex}>
                                        <div className="flex items-start gap-4">
                                          <div className="w-28 flex-shrink-0 pt-1">
                                            <span className={`font-bold text-sm ${characterColorMap.get(item.character) || "text-red-500"}`}>
                                              {item.character}
                                            </span>
                                            {item.timestamp && (
                                              <div className="text-xs text-neutral-500 font-mono mt-1">
                                                [{item.timestamp}]
                                              </div>
                                            )}
                                          </div>
                                          <div className="flex-grow text-white whitespace-pre-wrap">
                                            {item.line.replace(/\*\*/g, "").replace(/\*/g, "").replace(/\_\_/g, "").replace(/\_/g, "")}
                                          </div>
                                        </div>
                                        {item.imagePrompt && (
                                          <div className="mt-3 ml-[128px] p-3 rounded-md border bg-zinc-950 border-zinc-700/50">
                                            <p className="text-xs font-semibold text-neutral-400 mb-1">
                                              🎨 이미지 생성 프롬프트
                                            </p>
                                            <p className="text-sm text-neutral-300 font-mono">
                                              {item.imagePrompt}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  
                                  {/* 챕터별 다운로드 버튼 */}
                                  <div className="mt-4 pt-4 border-t border-zinc-700 flex gap-3">
                                    <button
                                      onClick={() => {
                                        const text = formatChapterScriptToText(chapter);
                                        if (!text || text.trim() === "") {
                                          alert("다운로드할 대본이 없습니다.");
                                          return;
                                        }
                                        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement("a");
                                        a.href = url;
                                        a.download = `chapter-${index + 1}-script.txt`;
                                        a.click();
                                        URL.revokeObjectURL(url);
                                      }}
                                      className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg flex items-center justify-center gap-2"
                                    >
                                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                      </svg>
                                      📜 대본
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (!chapter.script) {
                                          alert("다운로드할 내용이 없습니다.");
                                          return;
                                        }
                                        let text = `챕터 ${index + 1}: ${chapter.title}\n${"=".repeat(50)}\n\n`;
                                        chapter.script.forEach((item: any, idx: number) => {
                                          if (item.imagePrompt) {
                                            text += `[${idx + 1}] ${item.imagePrompt}\n\n`;
                                          }
                                        });
                                        if (text.trim() === `챕터 ${index + 1}: ${chapter.title}\n${"=".repeat(50)}\n\n`) {
                                          alert("이미지 프롬프트가 없습니다.");
                                          return;
                                        }
                                        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement("a");
                                        a.href = url;
                                        a.download = `chapter-${index + 1}-image-prompts.txt`;
                                        a.click();
                                        URL.revokeObjectURL(url);
                                      }}
                                      className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg flex items-center justify-center gap-2"
                                    >
                                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                      </svg>
                                      🎨 이미지
                                    </button>
                                  </div>
                                  
                                  {/* 다음 챕터 생성 버튼 */}
                                  {index < newPlan.chapters.length - 1 && !newPlan.chapters[index + 1].script && !newPlan.chapters[index + 1].isGenerating && (
                                    <div className="mt-4 pt-4 border-t border-zinc-700">
                                      <button
                                        onClick={() => handleGenerateChapterScript(newPlan.chapters[index + 1].id)}
                                        className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg flex items-center justify-center gap-2"
                                      >
                                        <span>챕터 {index + 2} 대본 생성하기</span>
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </ResultCard>
                )}

                {/* 일반 대본 (짧은 영상) */}
                {newPlan.scriptWithCharacters && newPlan.characters && (
                  <ResultCard
                    title="6. 생성된 대본"
                    contentToCopy={formatScriptWithCharactersToText(
                      newPlan.scriptWithCharacters
                    )}
                    downloadFileName="generated-script"
                  >
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold text-red-500 mb-3">
                          등장인물
                        </h3>
                        <div className="flex flex-wrap gap-2 p-4 bg-zinc-900 rounded-lg border border-[#2A2A2A]">
                          {newPlan.characters.map((character, index) => (
                            <span
                              key={index}
                              className={`font-medium px-3 py-1 rounded-full text-sm ${characterColorMap
                                .get(character)
                                ?.replace(
                                  "text-",
                                  "bg-"
                                )}/20 ${characterColorMap.get(character)}`}
                            >
                              {character}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-red-500 mb-3">
                          대본 내용
                        </h3>
                        <div className="space-y-4 max-h-[600px] overflow-y-auto p-4 bg-zinc-900 rounded-lg border border-[#2A2A2A]">
                          {newPlan.scriptWithCharacters.map((item, index) => (
                            <div key={index}>
                              <div className="flex items-start gap-4">
                                <div className="w-28 flex-shrink-0 pt-1">
                                  <span
                                    className={`font-bold text-sm ${
                                      characterColorMap.get(item.character) ||
                                      "text-red-500"
                                    }`}
                                  >
                                    {item.character}
                                  </span>
                                  {item.timestamp && (
                                    <div className="text-xs text-neutral-500 font-mono mt-1">
                                      [{item.timestamp}]
                                    </div>
                                  )}
                                </div>
                                <div className="flex-grow text-white whitespace-pre-wrap">
                                  {item.line
                                    .replace(/\*\*/g, "")
                                    .replace(/\*/g, "")
                                    .replace(/\_\_/g, "")
                                    .replace(/\_/g, "")}
                                </div>
                              </div>
                              {item.imagePrompt && (
                                <div className="mt-3 ml-[128px] p-3 rounded-md border bg-zinc-950 border-zinc-700/50">
                                  <p className="text-xs font-semibold text-neutral-400 mb-1">
                                    🎨 이미지 생성 프롬프트
                                  </p>
                                  <p className="text-sm text-neutral-300 font-mono">
                                    {item.imagePrompt}
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </ResultCard>
                )}

                {/* 다른 사이트 소개 섹션 */}
                {(newPlan.scriptWithCharacters || newPlan.chapters) && (
                  <div className="mt-8 bg-gradient-to-br from-purple-900/30 via-pink-900/30 to-blue-900/30 border-2 border-purple-500/50 rounded-xl p-8">
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-bold text-white mb-2">
                        🎬 더 많은 영상 제작 도구가 필요하신가요?
                      </h3>
                      <p className="text-lg text-neutral-200">
                        나도 유튜브로 인생 대박나보자!!
                      </p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <a
                        href="https://youtube.money-hotissue.com/image"
                        className="bg-gradient-to-br from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-bold py-6 px-8 rounded-lg transition-all duration-300 transform hover:scale-105 text-center shadow-lg"
                      >
                        <div className="text-4xl mb-3">📹</div>
                        <div className="text-xl font-bold">숏폼/롱폼 영상 소스 무제한 생성</div>
                        <p className="text-sm mt-2 opacity-90">'딸깍' 한 번으로 영상에 필요한 이미지들을 마음껏 만들어보세요</p>
                      </a>
                      <a
                        href="https://aimusic.money-hotissue.com/"
                        className="bg-gradient-to-br from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 text-white font-bold py-6 px-8 rounded-lg transition-all duration-300 transform hover:scale-105 text-center shadow-lg"
                      >
                        <div className="text-4xl mb-3">🔥</div>
                        <div className="text-xl font-bold">AI 음악 가사+썸네일 1초 완성</div>
                        <p className="text-sm mt-2 opacity-90">요즘 유행하는 플리 채널, 나도 만들어보기</p>
                      </a>
                    </div>
                  </div>
                )}

                {newPlan.scriptOutline && (
                  <ResultCard
                    title="6. 생성된 기획안 개요"
                    contentToCopy={formatOutlineToText(newPlan.scriptOutline)}
                    downloadFileName="plan-outline"
                  >
                    <div className="space-y-6">
                      {newPlan.scriptOutline.map(
                        (stage: OutlineStage, index: number) => (
                          <div
                            key={index}
                            className="bg-zinc-900 p-4 rounded-lg border border-[#2A2A2A]"
                          >
                            <h3 className="font-bold text-red-500 mb-2">
                              {stage.stage}
                            </h3>

                            <p className="text-sm text-neutral-200 mb-3">
                              {stage.purpose}
                            </p>
                            <div className="prose prose-invert max-w-none prose-p:text-white prose-strong:text-red-500 prose-strong:underline prose-strong:decoration-red-500/70 prose-strong:underline-offset-4">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {stage.details}
                              </ReactMarkdown>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </ResultCard>
                )}
              </>
            ) : (
              <div className="bg-[#1A1A1A] border-2 border-dashed border-[#2A2A2A] rounded-xl p-8 text-center text-neutral-400">
                <p className="text-lg font-semibold">
                  생성된 기획안이 여기에 표시됩니다
                </p>
                <p className="mt-2 text-sm">
                  {analysisResult
                    ? "새로운 영상의 키워드를 입력하고 기획안을 생성해주세요."
                    : "먼저 영상을 분석하여 기획안 생성 기능을 활성화하세요."}
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
      <Footer />

      {/* 플로팅 초기화 버튼 */}
      {(analysisResult || newPlan || transcript || youtubeUrl) && (
        <button
          onClick={handleReset}
          className="fixed bottom-24 right-6 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 flex items-center gap-2 font-semibold z-50 border-2 border-red-400"
          title="모든 내용 초기화"
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
          <span>초기화</span>
        </button>
      )}

      {/* 사이드바 광고 - 애드블럭 감지 시 숨김 */}
      {!adBlockDetected && <SidebarAds />}

      {/* 플로팅 앵커 광고 - 애드블럭 감지 시 숨김 */}
      {!adBlockDetected && <FloatingAnchorAd />}
    </div>
  );
};

export default App;
