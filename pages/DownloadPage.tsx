import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export interface DownloadOptions {
  format: "txt" | "md" | "pdf";
  includeMetadata: boolean;
  includeTimestamp: boolean;
  downloadType: "script" | "imagePrompts" | "both";
}

const DownloadPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { title, content, imagePrompts, returnPath } = location.state || {};

  const [format, setFormat] = useState<"txt" | "md" | "pdf">("txt");
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeTimestamp, setIncludeTimestamp] = useState(true);
  const [downloadType, setDownloadType] = useState<"script" | "imagePrompts" | "both">("script");

  useEffect(() => {
    if (!content && !imagePrompts) {
      // 다운로드할 데이터가 없으면 홈으로 리다이렉트
      navigate(returnPath || "/");
    }
  }, [content, imagePrompts, navigate, returnPath]);

  const removeTimestampsFromText = (text: string) => {
    return text.replace(/^\[[^\]]+\]\s*/gm, "");
  };

  const buildScriptContent = () => {
    const baseContent = content || "대본이 없습니다.";
    return includeTimestamp ? baseContent : removeTimestampsFromText(baseContent);
  };

  const buildImagePromptContent = () => {
    return imagePrompts || "이미지 프롬프트가 없습니다.";
  };

  const applyMetadata = (text: string) => {
    if (!includeMetadata) return text;
    const metaTitle = title ? `제목: ${title}` : "제목: 다운로드";
    const metaDate = `생성일: ${new Date().toLocaleString("ko-KR")}`;
    return `${metaTitle}\n${metaDate}\n\n${text}`;
  };

  const handleDownload = () => {
    let finalContent = "";
    
    if (downloadType === "script") {
      finalContent = buildScriptContent();
    } else if (downloadType === "imagePrompts") {
      finalContent = buildImagePromptContent();
    } else if (downloadType === "both") {
      finalContent =
        buildScriptContent() +
        "\n\n" +
        "=".repeat(50) +
        "\n\n이미지 생성 프롬프트\n" +
        "=".repeat(50) +
        "\n\n" +
        buildImagePromptContent();
    }

    if (!finalContent || finalContent.trim() === "") {
      finalContent = "내용이 없습니다.";
    }

    finalContent = applyMetadata(finalContent);

    const blob = new Blob([finalContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    
    let fileName = title || "다운로드";
    if (downloadType === "script") {
      fileName += "-script";
    } else if (downloadType === "imagePrompts") {
      fileName += "-image-prompts";
    } else if (downloadType === "both") {
      fileName += "-complete";
    }
    fileName += `.${format}`;
    
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);

    // 다운로드 후 홈으로 돌아가기
    setTimeout(() => {
      navigate(returnPath || "/");
    }, 500);
  };

  if (!content && !imagePrompts) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white flex items-center justify-center p-4">
      <div className="relative bg-[#1A1A1A] border-2 border-red-500/50 rounded-2xl p-8 max-w-lg w-full shadow-[0_0_30px_rgba(217,0,0,0.3)]">
        {/* 닫기 버튼 */}
        <button
          onClick={() => navigate(returnPath || "/")}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* 헤더 */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">💾</span>
            <h2 className="text-2xl font-bold text-white">다운로드 옵션</h2>
          </div>
          <p className="text-sm text-neutral-400">
            5. 새로운 영상 기획 의도 파일을 다운로드합니다
          </p>
        </div>

        {/* 다운로드 내용 */}
        <div className="mb-6">
          <label className="block text-lg font-semibold text-white mb-3">
            📁 다운로드 내용
          </label>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { value: "script", label: "대본만", icon: "📜" },
              { value: "imagePrompts", label: "이미지 프롬프트", icon: "🎨" },
              { value: "both", label: "둘 다", icon: "📦" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setDownloadType(option.value as any)}
                className={`p-4 rounded-lg border-2 transition-all text-center ${
                  downloadType === option.value
                    ? "bg-gradient-to-br from-red-600/30 to-red-700/30 border-red-500 shadow-[0_0_15px_rgba(217,0,0,0.3)]"
                    : "bg-[#2A2A2A] border-[#3A3A3A] hover:border-red-500/50"
                }`}
              >
                <div className="text-2xl mb-2">{option.icon}</div>
                <div className="text-sm font-medium text-white">
                  {option.label}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 파일 형식 선택 */}
        <div className="mb-6">
          <label className="block text-lg font-semibold text-white mb-3">
            📄 파일 형식
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: "txt", label: "텍스트", icon: "📝" },
              { value: "md", label: "마크다운", icon: "📃" },
              { value: "pdf", label: "PDF", icon: "📕" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setFormat(option.value as any)}
                className={`p-4 rounded-lg border-2 transition-all text-center ${
                  format === option.value
                    ? "bg-gradient-to-br from-red-600/30 to-red-700/30 border-red-500 shadow-[0_0_15px_rgba(217,0,0,0.3)]"
                    : "bg-[#2A2A2A] border-[#3A3A3A] hover:border-red-500/50"
                }`}
              >
                <div className="text-2xl mb-2">{option.icon}</div>
                <div className="text-sm font-medium text-white">
                  {option.label}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 포함할 옵션 */}
        <div className="mb-6">
          <label className="block text-lg font-semibold text-white mb-3">
            📋 포함할 요소
          </label>
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-4 bg-[#2A2A2A] rounded-lg cursor-pointer hover:bg-[#3A3A3A] transition-colors">
              <input
                type="checkbox"
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.target.checked)}
                className="w-5 h-5 rounded border-2 border-red-500 bg-transparent checked:bg-red-600 checked:border-red-600 cursor-pointer accent-red-600"
              />
              <span className="text-sm text-neutral-200">
                메타데이터 (카테고리, 길이 등)
              </span>
            </label>
            {(downloadType === "script" || downloadType === "both") && (
            <label className="flex items-center gap-3 p-4 bg-[#2A2A2A] rounded-lg cursor-pointer hover:bg-[#3A3A3A] transition-colors">
              <input
                type="checkbox"
                checked={includeTimestamp}
                onChange={(e) => setIncludeTimestamp(e.target.checked)}
                className="w-5 h-5 rounded border-2 border-red-500 bg-transparent checked:bg-red-600 checked:border-red-600 cursor-pointer accent-red-600"
              />
              <span className="text-sm text-neutral-200">
                ???? ??
              </span>
            </label>
          )}
          </div>
        </div>

        {/* 다운로드 위치 안내 */}
        <div className="mb-6 p-4 bg-gradient-to-r from-red-900/20 to-orange-900/20 border border-red-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-lg">💡</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-400 mb-1">
                다운로드 위치:
              </p>
              <p className="text-xs text-neutral-300">
                브라우저의 기본 다운로드 폴더에 저장됩니다.
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                (일반적으로 "다운로드" 폴더)
              </p>
            </div>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate(returnPath || "/")}
            className="flex-1 bg-[#2A2A2A] hover:bg-[#3A3A3A] text-neutral-200 font-semibold py-3 px-6 rounded-lg transition-all duration-200 border border-[#3A3A3A]"
          >
            취소
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 shadow-[0_0_20px_rgba(217,0,0,0.4)] hover:shadow-[0_0_30px_rgba(217,0,0,0.6)] flex items-center justify-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            다운로드
          </button>
        </div>
      </div>
    </div>
  );
};

export default DownloadPage;
