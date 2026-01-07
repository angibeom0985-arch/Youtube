import React, { useState } from "react";
import { StoryboardImage as StoryboardImageType } from "../types";
import Spinner from "./Spinner";

interface StoryboardImageProps {
  item: StoryboardImageType;
  onRegenerate: (storyboardItemId: string, customPrompt?: string) => void;
}

const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className || "w-6 h-6"}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.181-3.183m-3.181-3.183l-3.181-3.183a8.25 8.25 0 00-11.664 0l-3.181 3.183"
    />
  </svg>
);

const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className || "w-6 h-6"}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
    />
  </svg>
);

const StoryboardImage: React.FC<StoryboardImageProps> = ({
  item,
  onRegenerate,
}) => {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  const handleRegenerateClick = () => {
    setShowCustomPrompt(true);
  };

  const handleConfirmRegenerate = async () => {
    setIsRegenerating(true);
    setShowCustomPrompt(false);
    await onRegenerate(item.id, customPrompt.trim() || undefined);
    setIsRegenerating(false);
    setCustomPrompt("");
  };

  const handleCancelRegenerate = () => {
    setShowCustomPrompt(false);
    setCustomPrompt("");
  };

  const handleDownloadClick = async () => {
    // 파일 시스템 API를 사용한 다운로드
    try {
      // Base64를 Blob으로 변환
      const base64Response = await fetch(`data:image/jpeg;base64,${item.image}`);
      const blob = await base64Response.blob();
      
      // File System Access API 지원 확인
      if ('showSaveFilePicker' in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: `영상소스_${item.id}_${item.sceneDescription.substring(0, 20).replace(/[^a-zA-Z0-9가-힣]/g, '_')}.jpg`,
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
      } else {
        // 폴백: 기존 다운로드 방식
        const link = document.createElement('a');
        link.href = `data:image/jpeg;base64,${item.image}`;
        link.download = `영상소스_${item.id}_${item.sceneDescription.substring(0, 20).replace(/[^a-zA-Z0-9가-힣]/g, '_')}.jpg`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[개발자용] 영상 소스 다운로드 오류:', err);
        console.error(`[개발자용] 오류 상세: ${err.name} - ${err.message}`);
        
        // 폴백: 기존 다운로드 방식
        const link = document.createElement('a');
        link.href = `data:image/jpeg;base64,${item.image}`;
        link.download = `영상소스_${item.id}_${item.sceneDescription.substring(0, 20).replace(/[^a-zA-Z0-9가-힣]/g, '_')}.jpg`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  };

  const handleImageClick = () => {
    // 새창에서 이미지 열기
    const imageWindow = window.open(
      "",
      "_blank",
      "width=900,height=600,scrollbars=yes,resizable=yes"
    );
    if (imageWindow) {
      imageWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>영상 소스 이미지 - ${item.sceneDescription}</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              background: #1a1a1a;
              color: white;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              min-height: 100vh;
            }
            .image-container {
              max-width: 100%;
              text-align: center;
            }
            img {
              max-width: 100%;
              height: auto;
              border-radius: 10px;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            }
            .info {
              margin-top: 20px;
              text-align: center;
            }
            .title {
              font-size: 20px;
              font-weight: bold;
              margin-bottom: 10px;
              color: #a6e22e;
            }
            .description {
              font-size: 16px;
              line-height: 1.5;
              color: #ccc;
              max-width: 700px;
            }
          </style>
        </head>
        <body>
          <div class="image-container">
            <img src="data:image/jpeg;base64,${item.image}" alt="${item.sceneDescription}">
            <div class="info">
              <div class="title">영상 소스 장면</div>
              <div class="description">${item.sceneDescription}</div>
            </div>
          </div>
        </body>
        </html>
      `);
      imageWindow.document.close();
    }
  };

  return (
    <div className="relative rounded-lg overflow-hidden shadow-lg group">
      {item.image && item.image.trim() !== "" ? (
        <>
          <img
            src={`data:image/jpeg;base64,${item.image}`}
            alt={item.sceneDescription}
            className="w-full h-full object-cover aspect-video transition-transform duration-300 group-hover:scale-105 cursor-pointer"
            onClick={handleImageClick}
          />
          {isRegenerating && (
            <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center z-10">
              <Spinner />
            </div>
          )}
          {!isRegenerating && (
            <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
              <button
                onClick={handleDownloadClick}
                className="bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                aria-label={`장면 이미지 다운로드: ${item.sceneDescription}`}
              >
                <DownloadIcon className="w-5 h-5" />
              </button>
              <button
                onClick={handleRegenerateClick}
                className="bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                aria-label={`장면 이미지 재생성: ${item.sceneDescription}`}
              >
                <RefreshIcon className="w-5 h-5" />
              </button>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none"></div>
          <p className="absolute bottom-0 left-0 p-4 text-white text-sm font-semibold z-10">
            {item.sceneDescription}
          </p>
        </>
      ) : (
        <>
          {/* 실패한 이미지 표시 */}
          <div className="w-full aspect-video bg-red-900/30 border-2 border-red-600 flex flex-col items-center justify-center p-4">
            <div className="text-6xl mb-4">❌</div>
            <div className="text-red-400 text-center font-bold mb-2">생성 실패</div>
            <div className="text-red-300 text-xs text-center mb-4 line-clamp-3">
              {item.sceneDescription}
            </div>
            {isRegenerating ? (
              <Spinner />
            ) : (
              <button
                onClick={handleRegenerateClick}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <RefreshIcon className="w-4 h-4" />
                <span>재생성</span>
              </button>
            )}
          </div>
        </>
      )}

      {/* 커스텀 프롬프트 모달 */}
      {showCustomPrompt && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={handleCancelRegenerate}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              장면 새로고침 - 원하는 느낌 추가
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              이 장면에 추가하고 싶은 느낌이나 스타일을 입력하세요. (선택사항)
            </p>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="예: 더 밝은 조명, 빈티지 필터, 영화적 분위기..."
              className="w-full h-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-gray-900"
              maxLength={200}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={handleCancelRegenerate}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleConfirmRegenerate}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                새로고침
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryboardImage;
