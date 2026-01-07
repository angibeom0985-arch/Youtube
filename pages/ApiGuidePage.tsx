import React, { useEffect } from 'react';
import { FiHome, FiExternalLink } from 'react-icons/fi';
import AdSense from '../components/AdSense';

const ApiGuidePage: React.FC = () => {
  useEffect(() => {
    // 페이지 제목 설정
    document.title = 'API 키 발급 가이드 - 유튜브 영상 분석 AI';
    
    // OG 태그 업데이트
    const updateMetaTag = (property: string, content: string) => {
      let meta = document.querySelector(`meta[property="${property}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('property', property);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };
    
    updateMetaTag('og:title', 'API 키 발급 가이드 - 유튜브 영상 분석 AI');
    updateMetaTag('og:description', '무료 Google Gemini API 키 발급 방법을 8단계로 쉽게 알려드립니다. 신용카드 등록 없이 바로 시작!');
    updateMetaTag('og:image', 'https://youtube.money-hotissue.com/og-image-api-guide.png');
    updateMetaTag('og:url', 'https://youtube.money-hotissue.com/api-guide');
  }, []);

  return (
    <div className="min-h-screen bg-[#121212] text-white font-sans p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <a href="/" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-4">
            <FiHome size={20} />
            <span>홈으로 돌아가기</span>
          </a>
          <h1 className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-r from-[#FF0000] to-[#FF2B2B] bg-clip-text text-transparent mb-4">
            Google Gemini API 키 발급 가이드
          </h1>
          <p className="text-neutral-300">유튜브 영상 분석 AI를 사용하기 위해 필요한 Google Gemini API 키를 발급받는 방법을 단계별로 안내드립니다.</p>
        </header>

        <main className="space-y-8">
          {/* 보안 및 비용 안내 */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
              <h3 className="text-blue-300 font-bold mb-2 flex items-center gap-2">
                🔒 보안 안내
              </h3>
              <ul className="text-sm space-y-1 text-neutral-300">
                <li>• API 키는 브라우저에만 저장되며, 외부 서버로 전송되지 않습니다.</li>
                <li>• 공용 컴퓨터를 사용하는 경우 '기억하기'를 체크하지 마세요.</li>
                <li>• API 키가 유출된 경우 즉시 Google AI Studio에서 재발급 받으세요.</li>
              </ul>
            </div>
            <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4">
              <h3 className="text-green-300 font-bold mb-2 flex items-center gap-2">
                💰 API 비용 안내
              </h3>
              <ul className="text-sm space-y-1 text-neutral-300">
                <li>• Gemini API 무료 등급에서 분석 기능 제공</li>
                <li>• 분당 15회 요청 제한만 있고, 결제나 비용 발생 없음</li>
                <li>• 분당 요청 수만 지키면 무료로 사용 가능</li>
              </ul>
            </div>
          </div>

          <AdSense />
          {/* 1단계: Google AI Studio 접속 */}
          <section className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-red-600 text-white font-bold text-lg">1</span>
              <h2 className="text-2xl font-bold text-white">Google AI Studio 접속</h2>
            </div>
            <div className="mb-4">
              <img src="/images/api 1.png" alt="Google AI Studio 메인 화면" className="w-full rounded-lg border border-[#2A2A2A]" />
            </div>
            <div className="space-y-3 text-neutral-300">
              <p>Google AI Studio 웹사이트에 접속합니다. 위 이미지와 같이 Google AI Studio의 메인 화면이 표시됩니다.</p>
              <p className="font-semibold">접속 주소:</p>
              <a
                href="https://aistudio.google.com"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <span>https://aistudio.google.com</span>
                <FiExternalLink size={16} />
              </a>
              <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3 mt-3">
                <p className="text-blue-300 text-sm">💡 참고: Google 계정으로 로그인하면 됩니다. 별도 계정 생성이 필요하지 않습니다.</p>
              </div>
            </div>
          </section>

          {/* 2단계: 프로젝트 만들기 1 */}
          <section className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-red-600 text-white font-bold text-lg">2</span>
              <h2 className="text-2xl font-bold text-white">프로젝트 만들기 1</h2>
            </div>
            <div className="mb-4">
              <img src="/images/api 2.png" alt="API ? ?? 버튼 클릭" className="w-full rounded-lg border border-[#2A2A2A]" />
            </div>
            <div className="space-y-3 text-neutral-300">
              <p>위 스크린샷과 같이 왼쪽 사이드바에서 <strong>"API ? ??"</strong> 버튼을 클릭하여 API 키 생성 페이지로 이동합니다.</p>
              <p className="font-semibold">순서:</p>
              <p>No Cloud Projects Available 클릭하면, 아래 'Create project'가 나옵니다.</p>
              <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 mt-3">
                <p className="text-yellow-300 text-sm">⚠️ Import project: Google Cloud 프로젝트가 있는 경우에만 선택</p>
              </div>
            </div>
          </section>

          <AdSense />

          {/* 3단계: 프로젝트 만들기 2 */}
          <section className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-red-600 text-white font-bold text-lg">3</span>
              <h2 className="text-2xl font-bold text-white">프로젝트 만들기 2</h2>
            </div>
            <div className="mb-4">
              <img src="/images/api 3.png" alt="API ? ??? 버튼 클릭" className="w-full rounded-lg border border-[#2A2A2A]" />
            </div>
            <div className="space-y-3 text-neutral-300">
              <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-3">
                <p className="text-green-300 text-sm">✅ '프로젝트 이름'은 본인이 구별하기 쉬운 단어로 작성</p>
              </div>
            </div>
          </section>

          {/* 4단계: 새 키 생성 */}
          <section className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-red-600 text-white font-bold text-lg">4</span>
              <h2 className="text-2xl font-bold text-white">새 키 생성</h2>
            </div>
            <div className="mb-4">
              <img src="/images/api 4.png" alt="프로젝트 선택 화면" className="w-full rounded-lg border border-[#2A2A2A]" />
            </div>
            <div className="space-y-3 text-neutral-300">
              <div className="space-y-2">
                <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-3">
                  <p className="text-green-300 text-sm">✅ '키 이름' 또한 본인이 구별할 수 있는 단어로 입력</p>
                </div>
                <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3">
                  <p className="text-yellow-300 text-sm">⚠️ '가져온 프로젝트 선택'은 아까 만든 프로젝트 선택</p>
                </div>
              </div>
            </div>
          </section>

          {/* 5단계: API 키 생성 완료 및 복사 */}
          <section className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-red-600 text-white font-bold text-lg">5</span>
              <h2 className="text-2xl font-bold text-white">API 키 생성 완료 및 복사</h2>
            </div>
            <div className="mb-4">
              <img src="/images/api 5.png" alt="생성된 API 키 화면" className="w-full rounded-lg border border-[#2A2A2A]" />
            </div>
            <div className="space-y-3 text-neutral-300">
              <p>'키 만들기' 누르면 끝입니다.</p>
              <p className="font-semibold">API 키 형태 예시:</p>
              <code className="block bg-zinc-900 p-3 rounded-lg text-sm font-mono">
                AIzaSyB1234567890abcdefghijklmnopqrstuvwx
              </code>
              <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 mt-3">
                <p className="text-yellow-300 font-semibold text-sm">⚠️ 중요: API 키는 한 번만 표시되므로 반드시 복사하여 안전한 곳에 저장하세요.</p>
              </div>
            </div>
          </section>

          <AdSense />

          {/* 6단계: 유튜브 영상 분석 AI에 API 키 입력 */}
          <section className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-red-600 text-white font-bold text-lg">6</span>
              <h2 className="text-2xl font-bold text-white">유튜브 영상 분석 AI에 API 키 입력</h2>
            </div>
            <div className="mb-4">
              <img src="/images/api 6.png" alt="웹사이트에 API 키 입력" className="w-full rounded-lg border border-[#2A2A2A]" />
            </div>
            <div className="space-y-3 text-neutral-300">
              <p>API 키가 성공적으로 생성되었습니다! 생성된 API 키를 복사하여 안전한 곳에 보관합니다. 복사 버튼을 클릭하여 클립보드에 저장하세요.</p>
              <p>이제 유튜브 영상 분석 AI 웹사이트로 돌아가서 발급받은 API 키를 입력합니다. "Google Gemini API 키" 입력 필드에 복사한 API 키를 붙여넣기 하세요.</p>
              <p className="font-semibold">입력 방법:</p>
              <ol className="list-decimal list-inside ml-4 space-y-1">
                <li>우측 상단 'API 키' 버튼 클릭</li>
                <li>Ctrl+V로 복사한 API 키 붙여넣기</li>
                <li>'저장하기' 버튼 클릭</li>
              </ol>
            </div>
          </section>

          {/* 7단계: 결제 설정 */}
          <section className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-red-600 text-white font-bold text-lg">7</span>
              <h2 className="text-2xl font-bold text-white">'결제 설정'</h2>
            </div>
            <div className="mb-4">
              <img src="/images/api 7.png" alt="API 키 테스트 화면" className="w-full rounded-lg border border-[#2A2A2A]" />
            </div>
            <div className="space-y-3 text-neutral-300">
              <div className="space-y-2">
                <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-3">
                  <p className="text-green-300 text-sm">✅ '결제 설정'까지 마쳐야, API를 사용할 수 있습니다.</p>
                </div>
                <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3">
                  <p className="text-red-300 text-sm">❌ '결제 설정'한다고 해서, 바로 결제되는 거 아니니 안심하세요.</p>
                </div>
              </div>
            </div>
          </section>

          {/* 8단계: 결제 설정 페이지 */}
          <section className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-red-600 text-white font-bold text-lg">8</span>
              <h2 className="text-2xl font-bold text-white">결제 설정 페이지</h2>
            </div>
            <div className="mb-4">
              <img src="/images/api 8.png" alt="설정 완료 및 서비스 이용" className="w-full rounded-lg border border-[#2A2A2A]" />
            </div>
            <div className="space-y-3 text-neutral-300">
              <p>이후 단계는 쉽게 하실 수 있습니다.</p>
              <p className="font-semibold text-green-400">축하합니다! API 키 설정이 모두 완료되었습니다.</p>
              <p>이제 유튜브 영상 분석 AI의 모든 기능을 사용할 수 있습니다. 영상 분석, 기획안 생성 등 모든 AI 기능이 활성화됩니다.</p>
              <p className="font-semibold">이제 사용 가능한 기능들:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>🎯 유튜브 영상 대본 분석</li>
                <li>📊 키워드 및 기획 의도 추출</li>
                <li>💡 조회수 예측 분석</li>
                <li>📝 새로운 영상 기획안 생성</li>
              </ul>
              <div className="text-center pt-4">
                <a
                  href="/"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-[#D90000] to-[#FF2B2B] text-white font-bold rounded-lg hover:from-[#D90000]/90 hover:to-[#FF2B2B]/90 transition-all"
                >
                  🚀 이제 분석기 사용하기 →
                </a>
              </div>
            </div>
          </section>

          <AdSense />

          {/* FAQ 섹션 */}
          <section className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-6">
            <h2 className="text-2xl font-bold text-red-500 mb-6">자주 묻는 질문 (FAQ)</h2>
            <div className="space-y-6 text-neutral-300">
              <div className="border-b border-[#2A2A2A] pb-4">
                <h3 className="font-bold text-white text-lg mb-2">Q: API 키가 작동하지 않아요</h3>
                <p>A: API 키를 정확히 복사했는지 확인하고, 앞뒤 공백이 없는지 체크해주세요. 또한 Google AI Studio에서 해당 프로젝트가 활성화되어 있는지 확인하세요.</p>
              </div>

              <div className="border-b border-[#2A2A2A] pb-4">
                <h3 className="font-bold text-white text-lg mb-2">Q: 무료로 얼마나 사용할 수 있나요?</h3>
                <p>A: Google Gemini API는 월 일정량까지 무료로 제공됩니다. 정확한 한도는 Google AI Studio에서 확인할 수 있습니다.</p>
              </div>

              <div>
                <h3 className="font-bold text-white text-lg mb-2">Q: API 키를 잃어버렸어요</h3>
                <p>A: Google AI Studio에서 새로운 API 키를 생성하거나, 기존 키를 다시 확인할 수 있습니다. 보안을 위해 이전 키는 비활성화하는 것이 좋습니다.</p>
              </div>
            </div>
          </section>

          {/* 관련 문서 */}
          <section className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-6">
            <h2 className="text-2xl font-bold text-red-500 mb-4">📚 관련 문서</h2>
            <div className="space-y-3 text-neutral-300">
              <a
                href="https://ai.google.dev/gemini-api/docs/rate-limits?hl=ko#free-tier"
                className="block p-4 bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors border border-[#2A2A2A]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white mb-1">🔄 Gemini API 속도 제한 (무료 등급)</h3>
                    <p className="text-sm text-neutral-400">무료 등급에서 사용 가능한 API 요청 제한에 대한 공식 문서</p>
                  </div>
                  <FiExternalLink className="flex-shrink-0 text-blue-400" size={20} />
                </div>
              </a>

              <a
                href="https://ai.google.dev/gemini-api/docs/pricing?hl=ko"
                className="block p-4 bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors border border-[#2A2A2A]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white mb-1">💰 Gemini API 요금 안내</h3>
                    <p className="text-sm text-neutral-400">API 사용 요금 및 무료/유료 등급 상세 정보</p>
                  </div>
                  <FiExternalLink className="flex-shrink-0 text-blue-400" size={20} />
                </div>
              </a>

              <a
                href="https://cloud.google.com/vertex-ai/generative-ai/docs/quotas?hl=ko"
                className="block p-4 bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors border border-[#2A2A2A]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white mb-1">📊 Vertex AI 할당량 및 한도</h3>
                    <p className="text-sm text-neutral-400">Google Cloud의 Vertex AI 생성형 AI 할당량 정보</p>
                  </div>
                  <FiExternalLink className="flex-shrink-0 text-blue-400" size={20} />
                </div>
              </a>
            </div>
          </section>

          {/* 하단 버튼 */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center py-8">
            <a
              href="/guide"
              className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-lg transition-all border border-[#2A2A2A]"
            >
              📖 전체 사용법 보기
            </a>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-[#D90000] to-[#FF2B2B] text-white font-bold rounded-lg hover:from-[#D90000]/90 hover:to-[#FF2B2B]/90 transition-all"
            >
              <FiHome size={20} />
              분석기로 돌아가기
            </a>
          </div>

          {/* 푸터 */}
          <div className="text-center text-neutral-500 text-sm border-t border-[#2A2A2A] pt-8">
            <p>© 2025 유튜브 영상 분석 AI. AI 기술을 활용한 콘텐츠 분석 도구입니다.</p>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ApiGuidePage;
