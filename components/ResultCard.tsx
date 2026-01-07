import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface ResultCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  contentToCopy: string;
  downloadFileName: string;
  imagePrompts?: string;
}

const ResultCard: React.FC<ResultCardProps> = ({
  title,
  children,
  className,
  contentToCopy,
  downloadFileName,
  imagePrompts,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleDownloadClick = () => {
    navigate("/download", {
      state: {
        title,
        content: contentToCopy,
        imagePrompts,
        returnPath: location.pathname || "/",
      },
    });
  };

  const preventSelection = (e: React.MouseEvent | React.DragEvent) => {
    e.preventDefault();
    return false;
  };

  const preventContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  const preventKeyboardCopy = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C")) {
      e.preventDefault();
      return false;
    }
  };

  return (
    <div
      className={`bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-6 mb-6 ${
        className || ""
      }`}
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-red-500">{title}</h2>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadClick}
            className="group relative px-6 py-3 bg-gradient-to-br from-[#D90000] to-[#FF2B2B] text-white font-bold rounded-lg shadow-[0_0_20px_rgba(255,43,43,0.5)] hover:shadow-[0_0_30px_rgba(255,43,43,0.8)] transition-all transform hover:scale-[1.05] hover:-translate-y-0.5 active:scale-[0.98]"
            title="다운로드 옵션 설정"
          >
            <span className="flex items-center gap-2">
              <svg
                className="w-5 h-5 animate-bounce"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              💾 다운로드
            </span>
            <div className="absolute inset-0 rounded-lg bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
          </button>
        </div>
      </div>

      <div
        className="text-white mt-4"
        onMouseDown={preventSelection}
        onDragStart={preventSelection}
        onContextMenu={preventContextMenu}
        onCopy={(e) => {
          e.preventDefault();
        }}
        onCut={(e) => {
          e.preventDefault();
        }}
        onKeyDown={preventKeyboardCopy}
        style={{
          userSelect: "none",
          WebkitUserSelect: "none",
          MozUserSelect: "none",
          msUserSelect: "none",
          cursor: "default",
        }}
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  );
};

export default ResultCard;
