import React from "react";

interface ApiKeyGuideProps {
  onBack?: () => void;
}

const ApiKeyGuide: React.FC<ApiKeyGuideProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 네비게이션 */}
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <a href="/" className="text-2xl font-bold text-blue-600">
                🎬 유튜브 이미지 생성기
              </a>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href="/"
                className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md"
              >
                홈으로
              </a>
              <button
                onClick={onBack}
                className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md"
              >
                사용법 가이드
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* 헤더 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Google Gemini API 키 발급 가이드
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            유튜브 롱폼 이미지 생성기를 사용하기 위해 필요한 Google Gemini API
            키를 발급받는 방법을 단계별로 안내드립니다.
          </p>
        </div>

        {/* 보안 안내 */}
        <div className="bg-amber-50 border-l-4 border-amber-500 p-6 mb-8">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-amber-500"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800">
                🔒 보안 안내
              </h3>
              <div className="mt-2 text-sm text-amber-700">
                <p>
                  • API 키는 암호화되어 브라우저에만 저장되며, 외부 서버로
                  전송되지 않습니다.
                </p>
                <p>
                  • 공용 컴퓨터를 사용하는 경우 '기억하기'를 체크하지 마세요.
                </p>
                <p>
                  • API 키가 유출된 경우 즉시 Google AI Studio에서 재발급
                  받으세요.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* API 비용 안내 */}
        <div className="bg-green-50 border-l-4 border-green-500 p-6 mb-8">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-green-500"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">
                💰 API 비용 안내
              </h3>
              <div className="mt-2 text-sm text-green-700 space-y-2">
                <p>• Gemini API 무료 등급에서 이미지 생성 기능 제공</p>
                <p>
                  •{" "}
                  <span className="font-bold text-green-800">
                    분당 15회 요청
                  </span>{" "}
                  제한만 있고, 결제나 비용 발생 없음
                </p>
                <p>
                  • 분당 요청 수만 지키면{" "}
                  <span className="font-bold text-green-800">무료</span>로 사용
                  가능
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 단계별 가이드 */}
        <div className="space-y-8">
          {/* 1단계 */}
          <div className="step-card bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center mb-6">
              <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold mr-4">
                1
              </span>
              <h2 className="text-2xl font-semibold text-gray-900">
                Google AI Studio 접속
              </h2>
            </div>

            <div className="mb-6">
              <img
                src="/api 1.png"
                alt="Google AI Studio 메인 화면"
                className="w-full rounded-lg border shadow-sm"
              />
            </div>

            <div className="space-y-4">
              <p className="text-gray-700">
                Google AI Studio 웹사이트에 접속합니다. 위 이미지와 같이 Google
                AI Studio의 메인 화면이 표시됩니다.
              </p>
              <div className="bg-gray-100 p-4 rounded-lg">
                <p className="font-medium text-gray-800">접속 주소:</p>
                <a
                  href="https://aistudio.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-lg"
                >
                  https://aistudio.google.com
                </a>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-blue-800">
                  💡 <strong>참고:</strong> Google 계정으로 로그인하면 됩니다.
                  별도 계정 생성이 필요하지 않습니다.
                </p>
              </div>
            </div>
          </div>

          {/* 2단계 */}
          <div className="step-card bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center mb-6">
              <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold mr-4">
                2
              </span>
              <h2 className="text-2xl font-semibold text-gray-900">
                프로젝트 만들기 1
              </h2>
            </div>

            <div className="mb-6">
              <img
                src="/api 2.png"
                alt="API ? ?? 버튼 클릭"
                className="w-full rounded-lg border shadow-sm"
              />
            </div>

            <div className="space-y-4">
              <p className="text-gray-700">
                위 스크린샷과 같이 왼쪽 사이드바에서 "API ? ??" 버튼을
                클릭하여 API 키 생성 페이지로 이동합니다.
              </p>
              <div className="bg-gray-100 p-4 rounded-lg">
                <p className="text-gray-800">
                  <strong>순서:</strong>
                  <br />
                  No Cloud Projects Available 클릭하면, 아래 'Create project'가
                  나옵니다.
                </p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-yellow-800">
                  ⚠️ <strong>Import project:</strong> Google Cloud 프로젝트가
                  있는 경우에만 선택
                </p>
              </div>
            </div>
          </div>

          {/* 3단계 */}
          <div className="step-card bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center mb-6">
              <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold mr-4">
                3
              </span>
              <h2 className="text-2xl font-semibold text-gray-900">
                프로젝트 만들기 2
              </h2>
            </div>

            <div className="mb-6">
              <img
                src="/api 3.png"
                alt="API ? ??? 버튼 클릭"
                className="w-full rounded-lg border shadow-sm"
              />
            </div>

            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-green-800">
                  ✅{" "}
                  <strong>
                    '프로젝트 이름'은 본인이 구별하기 쉬운 단어로 작성
                  </strong>
                </p>
              </div>
            </div>
          </div>

          {/* 4단계 */}
          <div className="step-card bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center mb-6">
              <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold mr-4">
                4
              </span>
              <h2 className="text-2xl font-semibold text-gray-900">
                새 키 생성
              </h2>
            </div>

            <div className="mb-6">
              <img
                src="/api 4.png"
                alt="프로젝트 선택 화면"
                className="w-full rounded-lg border shadow-sm"
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-green-800">
                    ✅{" "}
                    <strong>
                      '키 이름' 또한 본인이 구별할 수 있는 단어로 입력
                    </strong>
                  </p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-yellow-800">
                    ⚠️{" "}
                    <strong>
                      '가져온 프로젝트 선택'은 아까 만든 프로젝트 선택
                    </strong>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 5단계 */}
          <div className="step-card bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center mb-6">
              <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold mr-4">
                5
              </span>
              <h2 className="text-2xl font-semibold text-gray-900">
                API 키 생성 완료 및 복사
              </h2>
            </div>

            <div className="mb-6">
              <img
                src="/api 5.png"
                alt="생성된 API 키 화면"
                className="w-full rounded-lg border shadow-sm"
              />
            </div>

            <div className="space-y-4">
              <p className="text-gray-700">
                <strong>'키 만들기' 누르면 끝입니다.</strong>
              </p>
              <div className="bg-gray-900 p-4 rounded-lg mb-4">
                <p className="text-gray-300 text-sm mb-2">API 키 형태 예시:</p>
                <code className="text-green-400">
                  AIzaSyB1234567890abcdefghijklmnopqrstuvwx
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      "AIzaSyB1234567890abcdefghijklmnopqrstuvwx"
                    );
                    window
                      .open("", "", "width=320,height=180")
                      .document.write(
                        '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>알림</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-size:1.2rem;background:#18181b;color:#fff;}</style></head><body>API 키가 복사되었습니다.</body></html>'
                      );
                  }}
                  className="ml-4 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                  복사
                </button>
              </div>
              <div className="bg-red-50 border-l-4 border-red-500 p-4">
                <p className="text-red-800">
                  ⚠️ <strong>중요:</strong> API 키는 한 번만 표시되므로 반드시
                  복사하여 안전한 곳에 저장하세요.
                </p>
              </div>
            </div>
          </div>

          {/* 6단계 */}
          <div className="step-card bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center mb-6">
              <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold mr-4">
                6
              </span>
              <h2 className="text-2xl font-semibold text-gray-900">
                유튜브 이미지 생성기에 API 키 입력
              </h2>
            </div>

            <div className="mb-6">
              <img
                src="/api 6.png"
                alt="웹사이트에 API 키 입력"
                className="w-full rounded-lg border shadow-sm"
              />
            </div>

            <div className="space-y-4">
              <p className="text-gray-700">
                API 키가 성공적으로 생성되었습니다! 생성된 API 키를 복사하여
                안전한 곳에 보관합니다. 복사 버튼을 클릭하여 클립보드에
                저장하세요.
              </p>
              <p className="text-gray-700">
                이제 유튜브 이미지 생성기 웹사이트로 돌아가서 발급받은 API 키를
                입력합니다. "Google Gemini API 키" 입력 필드에 복사한 API 키를
                붙여넣기 하세요.
              </p>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-blue-800">
                  <strong>입력 방법:</strong>
                  <br />
                  1. API 키 입력 필드 클릭
                  <br />
                  2. Ctrl+V로 복사한 API 키 붙여넣기
                  <br />
                  3. 입력이 완료되면 다음 단계로 진행
                </p>
              </div>
            </div>
          </div>

          {/* 7단계 */}
          <div className="step-card bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center mb-6">
              <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold mr-4">
                7
              </span>
              <h2 className="text-2xl font-semibold text-gray-900">
                '결제 설정'
              </h2>
            </div>

            <div className="mb-6">
              <img
                src="/api 7.png"
                alt="API 키 테스트 화면"
                className="w-full rounded-lg border shadow-sm"
              />
            </div>

            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-green-800">
                  ✅{" "}
                  <strong>
                    '결제 설정'까지 마쳐야, API를 사용할 수 있습니다.
                  </strong>
                </p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-red-800">
                  ❌{" "}
                  <strong>
                    '결제 설정'한다고 해서, 바로 결제되는 거 아니니 안심하세요.
                  </strong>
                </p>
              </div>
            </div>
          </div>

          {/* 8단계 */}
          <div className="step-card bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center mb-6">
              <span className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold mr-4">
                8
              </span>
              <h2 className="text-2xl font-semibold text-gray-900">
                결제 설정 페이지
              </h2>
            </div>

            <div className="mb-6">
              <img
                src="/api 8.png"
                alt="설정 완료 및 서비스 이용"
                className="w-full rounded-lg border shadow-sm"
              />
            </div>

            <div className="space-y-4">
              <p className="text-gray-700">
                <strong>이후 단계는 쉽게 하실 수 있습니다.</strong>
              </p>
              <p className="text-gray-700">
                축하합니다! API 키 설정이 모두 완료되었습니다. 이제 유튜브 롱폼
                이미지 생성기의 모든 기능을 사용할 수 있습니다. 페르소나 생성,
                영상 소스 생성 등 모든 AI 기능이 활성화됩니다.
              </p>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-blue-800">
                  <strong>이제 사용 가능한 기능들:</strong>
                  <br />
                  • 🎭 페르소나 캐릭터 생성
                  <br />
                  • 📽️ 영상 소스 이미지 생성
                  <br />
                  • 🎨 일관된 스타일 유지
                  <br />• 📦 ZIP 파일 다운로드
                </p>
              </div>
              <div className="text-center mt-6">
                <a
                  href="/"
                  className="inline-block bg-blue-600 hover:bg-blue-800 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  🚀 이제 생성기 사용하기 →
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* 문제 해결 */}
        <div className="mt-12 bg-white rounded-lg p-6 shadow-md">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            자주 묻는 질문 (FAQ)
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">
                Q: API 키가 작동하지 않아요
              </h3>
              <p className="text-gray-700">
                A: API 키를 정확히 복사했는지 확인하고, 앞뒤 공백이 없는지
                체크해주세요. 또한 Google AI Studio에서 해당 프로젝트가
                활성화되어 있는지 확인하세요.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">
                Q: 무료로 얼마나 사용할 수 있나요?
              </h3>
              <p className="text-gray-700">
                A: Google Gemini API는 월 일정량까지 무료로 제공됩니다. 정확한
                한도는 Google AI Studio에서 확인할 수 있습니다.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">
                Q: API 키를 잃어버렸어요
              </h3>
              <p className="text-gray-700">
                A: Google AI Studio에서 새로운 API 키를 생성하거나, 기존 키를
                다시 확인할 수 있습니다. 보안을 위해 이전 키는 비활성화하는 것이
                좋습니다.
              </p>
            </div>
          </div>
        </div>

        {/* 관련 문서 섹션 */}
        <div className="mt-8 bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-lg">
          <h3 className="text-xl font-semibold text-blue-900 mb-4 flex items-center">
            <span className="mr-2">📚</span>
            관련 문서
          </h3>
          <div className="space-y-3">
            <div className="bg-white p-4 rounded-lg border border-blue-200 hover:shadow-md transition-shadow">
              <a
                href="https://ai.google.dev/gemini-api/docs/rate-limits?hl=ko#free-tier"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 font-medium flex items-center justify-between"
              >
                <span>🔄 Gemini API 속도 제한 (무료 등급)</span>
                <span className="text-gray-400">↗</span>
              </a>
              <p className="text-gray-600 text-sm mt-2">
                무료 등급에서 사용 가능한 API 요청 제한에 대한 공식 문서
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-blue-200 hover:shadow-md transition-shadow">
              <a
                href="https://ai.google.dev/gemini-api/docs/pricing?hl=ko"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 font-medium flex items-center justify-between"
              >
                <span>💰 Gemini API 요금 안내</span>
                <span className="text-gray-400">↗</span>
              </a>
              <p className="text-gray-600 text-sm mt-2">
                API 사용 요금 및 무료/유료 등급 상세 정보
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-blue-200 hover:shadow-md transition-shadow">
              <a
                href="https://cloud.google.com/vertex-ai/generative-ai/docs/quotas?hl=ko"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 font-medium flex items-center justify-between"
              >
                <span>📊 Vertex AI 할당량 및 한도</span>
                <span className="text-gray-400">↗</span>
              </a>
              <p className="text-gray-600 text-sm mt-2">
                Google Cloud의 Vertex AI 생성형 AI 할당량 정보
              </p>
            </div>
          </div>
        </div>

        {/* 도움말 링크 */}
        <div className="mt-8 text-center">
          <div className="space-x-4">
            <button
              onClick={onBack}
              className="text-purple-600 hover:underline"
            >
              전체 사용법 보기
            </button>
            <span className="text-gray-400">|</span>
            <a href="/" className="text-purple-600 hover:underline">
              생성기로 돌아가기
            </a>
          </div>
        </div>
      </div>

      {/* 푸터 */}
      <footer className="bg-gray-800 text-white py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p>
            &copy; 2025 유튜브 롱폼 이미지 생성기. AI 기술을 활용한 콘텐츠 제작
            도구입니다.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default ApiKeyGuide;
