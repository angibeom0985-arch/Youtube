import React, { useState } from "react";

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownload: (options: DownloadOptions) => void;
  title: string;
}

export interface DownloadOptions {
  format: "txt" | "md" | "pdf";
  includeMetadata: boolean;
  includeTimestamp: boolean;
  downloadType: "script" | "imagePrompts" | "both"; // 추가
}

const DownloadModal: React.FC<DownloadModalProps> = ({
  isOpen,
  onClose,
  onDownload,
  title,
}) => {
  const [format, setFormat] = useState<"txt" | "md" | "pdf">("txt");
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeTimestamp, setIncludeTimestamp] = useState(true);
  const [downloadType, setDownloadType] = useState<"script" | "imagePrompts" | "both">("script");

  if (!isOpen) return null;

  const handleDownload = () => {
    onDownload({
      format,
      includeMetadata,
      includeTimestamp,
      downloadType,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 모달 컨텐츠 */}
      <div className="relative bg-[#1A1A1A] border-2 border-red-500/50 rounded-2xl p-8 max-w-lg w-full mx-4 shadow-[0_0_30px_rgba(217,0,0,0.3)]">
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white transition-colors"
          aria-label="닫기"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* 제목 */}
        <h2 className="text-2xl font-bold text-white mb-2">
          💾 다운로드 옵션
        </h2>
        <p className="text-sm text-neutral-400 mb-6">
          {title} 파일을 다운로드합니다
        </p>

        {/* 파일 형식 선택 */}
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
                onClick={() => setDownloadType(option.value as "script" | "imagePrompts" | "both")}
                className={`p-4 rounded-lg border-2 transition-all ${
                  downloadType === option.value
                    ? "bg-gradient-to-br from-[#D90000] to-[#FF2B2B] border-red-500 text-white shadow-[0_0_15px_rgba(255,43,43,0.5)]"
                    : "bg-[#2A2A2A] border-[#3A3A3A] text-neutral-300 hover:border-red-500/50"
                }`}
              >
                <div className="text-2xl mb-1">{option.icon}</div>
                <div className="text-xs font-medium">{option.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 파일 형식 선택 */}
        <div className="mb-6">
          <label className="block text-lg font-semibold text-white mb-3">
            📁 파일 형식
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: "txt", label: "텍스트", icon: "📄" },
              { value: "md", label: "마크다운", icon: "📝" },
              { value: "pdf", label: "PDF", icon: "📕" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setFormat(option.value as "txt" | "md" | "pdf")}
                className={`p-4 rounded-lg border-2 transition-all ${
                  format === option.value
                    ? "bg-gradient-to-br from-[#D90000] to-[#FF2B2B] border-red-500 text-white shadow-[0_0_15px_rgba(255,43,43,0.5)]"
                    : "bg-[#2A2A2A] border-[#3A3A3A] text-neutral-300 hover:border-red-500/50"
                }`}
              >
                <div className="text-2xl mb-1">{option.icon}</div>
                <div className="text-sm font-medium">{option.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 포함할 요소 선택 */}
        <div className="mb-6">
          <label className="block text-lg font-semibold text-white mb-3">
            📋 포함할 요소
          </label>
          <div className="space-y-3">
            <label className="flex items-center p-3 rounded-lg bg-[#2A2A2A] hover:bg-[#3A3A3A] transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.target.checked)}
                className="w-5 h-5 rounded border-2 border-neutral-500 bg-[#121212] checked:bg-red-600 checked:border-red-600 focus:ring-2 focus:ring-red-500 focus:ring-offset-0 transition-colors cursor-pointer"
              />
              <span className="ml-3 text-neutral-200">
                메타데이터 (카테고리, 길이 등)
              </span>
            </label>
            <label className="flex items-center p-3 rounded-lg bg-[#2A2A2A] hover:bg-[#3A3A3A] transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={includeTimestamp}
                onChange={(e) => setIncludeTimestamp(e.target.checked)}
                className="w-5 h-5 rounded border-2 border-neutral-500 bg-[#121212] checked:bg-red-600 checked:border-red-600 focus:ring-2 focus:ring-red-500 focus:ring-offset-0 transition-colors cursor-pointer"
              />
              <span className="ml-3 text-neutral-200">
                생성 시간 및 날짜
              </span>
            </label>
          </div>
        </div>

        {/* 다운로드 위치 안내 */}
        <div className="mb-6 p-4 rounded-lg bg-zinc-900 border border-zinc-700">
          <p className="text-sm text-neutral-300 mb-2">
            <span className="font-semibold text-yellow-400">📍 다운로드 위치:</span>
          </p>
          <p className="text-xs text-neutral-400">
            브라우저의 기본 다운로드 폴더에 저장됩니다.
            <br />
            (일반적으로 "다운로드" 폴더)
          </p>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-lg border-2 border-neutral-600 text-neutral-300 font-semibold hover:bg-neutral-800 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 py-3 px-4 rounded-lg bg-gradient-to-br from-[#D90000] to-[#FF2B2B] text-white font-bold shadow-[0_0_20px_rgba(255,43,43,0.5)] hover:shadow-[0_0_30px_rgba(255,43,43,0.7)] transition-all transform hover:scale-[1.02]"
          >
            💾 다운로드
          </button>
        </div>
      </div>
    </div>
  );
};

export default DownloadModal;
