import React, { useEffect } from "react";
import { FiHome } from "react-icons/fi";

const GuidePage: React.FC = () => {
  useEffect(() => {
    document.title = "사용법 - 유튜브 영상 제작 AI";

    const updateMetaTag = (property: string, content: string) => {
      let meta = document.querySelector(`meta[property="${property}"]`);
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("property", property);
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    };

    updateMetaTag("og:title", "사용법 - 유튜브 영상 제작 AI");
    updateMetaTag(
      "og:description",
      "대본 생성, 이미지 생성, TTS 기능별 사용법을 빠르게 확인하세요."
    );
    updateMetaTag("og:image", "https://youtube.money-hotissue.com/og-image-guide.png");
    updateMetaTag("og:url", "https://youtube.money-hotissue.com/guide");
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0B0F] text-white font-sans p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10">
          <a href="/" className="inline-flex items-center gap-2 text-blue-300 hover:text-blue-200 mb-4">
            <FiHome size={18} />
            <span>홈으로</span>
          </a>
          <h1 className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-r from-[#FF7A00] to-[#FF2B2B] bg-clip-text text-transparent">
            사용법 안내
          </h1>
          <p className="mt-3 text-neutral-300">
            필요한 기능의 사용법을 선택해 빠르게 확인하세요.
          </p>
        </header>

        <main className="space-y-6">
          <section className="bg-[#14141A] border border-[#2A2A2A] rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-orange-300 mb-3">대본 생성 사용법</h2>
            <p className="text-neutral-300">
              유튜브 URL 또는 직접 입력한 대본을 분석해 기획과 스크립트를 만드는 방법을 안내합니다.
            </p>
            <a
              href="/script/guide"
              className="mt-4 inline-flex items-center rounded-lg bg-orange-500/20 px-4 py-2 text-sm font-semibold text-orange-100 hover:bg-orange-500/30"
            >
              대본 생성 가이드 보기
            </a>
          </section>

          <section className="bg-[#14141A] border border-[#2A2A2A] rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-pink-300 mb-3">이미지 생성 사용법</h2>
            <p className="text-neutral-300">
              캐릭터 설정과 스타일 선택 후 이미지 결과를 받는 흐름을 정리합니다.
            </p>
            <a
              href="/imgae/guide"
              className="mt-4 inline-flex items-center rounded-lg bg-pink-500/20 px-4 py-2 text-sm font-semibold text-pink-100 hover:bg-pink-500/30"
            >
              이미지 생성 가이드 보기
            </a>
          </section>

          <section className="bg-[#14141A] border border-[#2A2A2A] rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-emerald-300 mb-3">TTS 사용법</h2>
            <p className="text-neutral-300">
              텍스트 입력부터 목소리 선택, MP3 다운로드까지의 절차를 안내합니다.
            </p>
            <a
              href="/tts/guide"
              className="mt-4 inline-flex items-center rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/30"
            >
              TTS 가이드 보기
            </a>
          </section>
        </main>
      </div>
    </div>
  );
};

export default GuidePage;
