import React, { useEffect } from "react";
import { FiHome } from "react-icons/fi";

const ScriptGuidePage: React.FC = () => {
  useEffect(() => {
    document.title = "대본 생성 사용법 - 유튜브 영상 제작 AI";

    const updateMetaTag = (property: string, content: string) => {
      let meta = document.querySelector(`meta[property="${property}"]`);
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("property", property);
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    };

    updateMetaTag("og:title", "대본 생성 사용법 - 유튜브 영상 제작 AI");
    updateMetaTag(
      "og:description",
      "유튜브 분석부터 기획/대본 생성까지 빠르게 따라하는 사용법."
    );
    updateMetaTag("og:image", "https://youtube.money-hotissue.com/og-image-guide.png");
    updateMetaTag("og:url", "https://youtube.money-hotissue.com/script/guide");
  }, []);

  return (
    <div className="min-h-screen bg-[#0C0C10] text-white font-sans p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10">
          <a href="/script" className="inline-flex items-center gap-2 text-orange-300 hover:text-orange-200 mb-4">
            <FiHome size={18} />
            <span>대본 생성으로 돌아가기</span>
          </a>
          <h1 className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-r from-[#FF6A00] to-[#FF2B2B] bg-clip-text text-transparent">
            대본 생성 사용법
          </h1>
          <p className="mt-3 text-neutral-300">
            유튜브 영상 분석부터 새로운 대본 생성까지의 흐름을 안내합니다.
          </p>
        </header>

        <main className="space-y-6">
          <section className="bg-[#14141A] border border-[#2A2A2A] rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-orange-300 mb-4">1. 분석 자료 입력</h2>
            <ul className="space-y-2 text-neutral-300 list-disc list-inside">
              <li>유튜브 URL을 입력하면 제목과 요약이 자동으로 채워집니다.</li>
              <li>직접 준비한 대본이나 요약 텍스트를 붙여넣어도 됩니다.</li>
              <li>카테고리를 선택하면 분석 톤과 구조가 달라집니다.</li>
            </ul>
          </section>

          <section className="bg-[#14141A] border border-[#2A2A2A] rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-orange-300 mb-4">2. 분석 시작</h2>
            <ul className="space-y-2 text-neutral-300 list-disc list-inside">
              <li>"영상 분석 시작" 버튼을 누르면 핵심 키워드와 기획 포인트가 생성됩니다.</li>
              <li>중요 키워드에 강조 표시가 되어 후속 작업에 활용하기 쉽습니다.</li>
              <li>결과 카드에서 원하는 항목만 골라 정리할 수 있습니다.</li>
            </ul>
          </section>

          <section className="bg-[#14141A] border border-[#2A2A2A] rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-orange-300 mb-4">3. 기획/대본 생성</h2>
            <ul className="space-y-2 text-neutral-300 list-disc list-inside">
              <li>영상 길이, 구성, 스타일을 선택해 새 기획을 생성합니다.</li>
              <li>필요한 장면이나 포인트를 직접 추가해 완성도를 높일 수 있습니다.</li>
              <li>생성된 대본은 바로 복사하거나 재생성으로 수정할 수 있습니다.</li>
            </ul>
          </section>

          <section className="bg-[#14141A] border border-[#2A2A2A] rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-orange-300 mb-4">4. 결과 활용</h2>
            <ul className="space-y-2 text-neutral-300 list-disc list-inside">
              <li>TXT, Markdown, PDF 형식으로 다운로드할 수 있습니다.</li>
              <li>아이디어 카드만 모아서 요약본으로 만들 수도 있습니다.</li>
              <li>후속 작업을 위해 결과를 저장해두는 것을 추천합니다.</li>
            </ul>
          </section>

          <section className="bg-[#1A1208] border border-[#3A2A1A] rounded-2xl p-6">
            <h2 className="text-xl font-bold text-orange-200 mb-3">효율을 높이는 팁</h2>
            <ul className="space-y-2 text-orange-100/80 list-disc list-inside">
              <li>대본을 구체적으로 입력할수록 분석 정확도가 올라갑니다.</li>
              <li>핵심 키워드는 짧고 명확하게 작성하세요.</li>
              <li>서로 다른 카테고리를 비교하면 색다른 기획이 나옵니다.</li>
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
};

export default ScriptGuidePage;
