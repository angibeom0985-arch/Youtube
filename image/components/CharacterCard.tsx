import React, { useState } from "react";
import { Character } from "../types";
import Spinner from "./Spinner";

interface CharacterCardProps {
  character: Character;
  onRegenerate: (
    characterId: string,
    description: string,
    name: string,
    customPrompt?: string
  ) => void;
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

const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
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
    await onRegenerate(
      character.id,
      character.description,
      character.name,
      customPrompt.trim() || undefined
    );
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
      const base64Response = await fetch(`data:image/jpeg;base64,${character.image}`);
      const blob = await base64Response.blob();
      
      // File System Access API 지원 확인
      if ('showSaveFilePicker' in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: `${character.name.replace(/[^a-zA-Z0-9가-힣]/g, '_')}_페르소나.jpg`,
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
        link.href = `data:image/jpeg;base64,${character.image}`;
        link.download = `${character.name.replace(/[^a-zA-Z0-9가-힣]/g, '_')}_페르소나.jpg`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[개발자용] 페르소나 다운로드 오류:', err);
        console.error(`[개발자용] 오류 상세: ${err.name} - ${err.message}`);
        
        // 폴백: 기존 다운로드 방식
        const link = document.createElement('a');
        link.href = `data:image/jpeg;base64,${character.image}`;
        link.download = `${character.name.replace(/[^a-zA-Z0-9가-힣]/g, '_')}_페르소나.jpg`;
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
      "width=900,height=700,scrollbars=yes,resizable=yes"
    );
    if (imageWindow) {
      imageWindow.document.write(`
                <!DOCTYPE html>
                <html lang="ko">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>${character.name} - 페르소나 이미지</title>
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
                        .name {
                            font-size: 24px;
                            font-weight: bold;
                            margin-bottom: 10px;
                            color: #66d9ef;
                        }
                        .description {
                            font-size: 16px;
                            line-height: 1.5;
                            color: #ccc;
                            max-width: 600px;
                            margin: 0 auto 20px;
                        }
                        .button-container {
                            display: flex;
                            gap: 10px;
                            justify-content: center;
                            margin-top: 20px;
                        }
                        .btn {
                            padding: 12px 24px;
                            border: none;
                            border-radius: 8px;
                            font-size: 16px;
                            font-weight: bold;
                            cursor: pointer;
                            transition: all 0.3s;
                            display: inline-flex;
                            align-items: center;
                            gap: 8px;
                        }
                        .btn-download {
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                        }
                        .btn-download:hover {
                            transform: translateY(-2px);
                            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                        }
                        .btn-close {
                            background: #333;
                            color: white;
                        }
                        .btn-close:hover {
                            background: #444;
                        }
                    </style>
                </head>
                <body>
                    <div class="image-container">
                        <img src="data:image/jpeg;base64,${character.image}" alt="${character.name}" id="characterImage">
                        <div class="info">
                            <div class="name">${character.name}</div>
                            <div class="description">${character.description}</div>
                            <div class="button-container">
                                <button class="btn btn-download" onclick="downloadImage()">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="20" height="20">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                    </svg>
                                    다운로드
                                </button>
                                <button class="btn btn-close" onclick="window.close()">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="20" height="20">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    닫기
                                </button>
                            </div>
                        </div>
                    </div>
                    <script>
                        function downloadImage() {
                            // 이미지 다운로드 (새창으로 다운로드 위치 선택)
                            const link = document.createElement('a');
                            link.href = 'data:image/jpeg;base64,${character.image}';
                            link.download = '${character.name.replace(/[^a-zA-Z0-9가-힣]/g, '_')}_페르소나.jpg';
                            link.target = '_blank';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }
                    </script>
                </body>
                </html>
            `);
      imageWindow.document.close();
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
      <div className="relative group">
        <img
          src={`data:image/jpeg;base64,${character.image}`}
          alt={character.name}
          className="w-full h-72 object-cover cursor-pointer"
          onClick={handleImageClick}
        />
        {isRegenerating && (
          <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
            <Spinner />
          </div>
        )}
        {!isRegenerating && (
          <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button
              onClick={handleDownloadClick}
              className="bg-black bg-opacity-50 text-white p-3 rounded-full hover:bg-opacity-75 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              aria-label={`${character.name} 이미지 다운로드`}
            >
              <DownloadIcon className="w-6 h-6" />
            </button>
            <button
              onClick={handleRegenerateClick}
              className="bg-black bg-opacity-50 text-white p-3 rounded-full hover:bg-opacity-75 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              aria-label={`${character.name} 이미지 재생성`}
            >
              <RefreshIcon className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-xl font-bold text-indigo-300">{character.name}</h3>
        <p className="text-gray-400 mt-2 text-sm">{character.description}</p>
      </div>

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
              원하는 느낌 추가하기
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              추가하고 싶은 느낌이나 스타일을 입력하세요. (선택사항)
            </p>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="예: 더 밝은 표정, 빈티지 스타일, 따뜻한 조명..."
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

export default CharacterCard;
