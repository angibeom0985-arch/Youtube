import React, { useEffect } from "react";
import { FiHome } from "react-icons/fi";

const TtsGuidePage: React.FC = () => {
  useEffect(() => {
    document.title = "TTS 사용법 - 유튜브 영상 제작 AI";

    const updateMetaTag = (property: string, content: string) => {
      let meta = document.querySelector(`meta[property="${property}"]`);
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("property", property);
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    };

    updateMetaTag("og:title", "TTS 사용법 - 유튜브 영상 제작 AI");
    updateMetaTag(
      "og:description",
      "텍스트 입력부터 목소리 설정, MP3 다운로드까지 안내합니다."
    );
    updateMetaTag("og:image", "https://youtube.money-hotissue.com/og-image-guide.png");
    updateMetaTag("og:url", "https://youtube.money-hotissue.com/tts/guide");
  }, []);

  return (
    <div className="min-h-screen bg-[#081412] text-white font-sans p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10">
          <a href="/tts" className="inline-flex items-center gap-2 text-emerald-300 hover:text-emerald-200 mb-4">
            <FiHome size={18} />
            <span>TTS로 돌아가기</span>
          </a>
          <h1 className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-r from-[#10B981] to-[#34D399] bg-clip-text text-transparent">
            TTS 사용법
          </h1>
          <p className="mt-3 text-neutral-300">
            텍스트를 입력하고 음성 옵션을 조정해 MP3로 받는 방법을 설명합니다.
          </p>
        </header>

        <main className="space-y-6">
          <section className="bg-[#10221D] border border-[#25473E] rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-emerald-300 mb-4">1. 텍스트 입력</h2>
            <ul className="space-y-2 text-neutral-300 list-disc list-inside">
              <li>변환할 대본이나 내레이션을 입력합니다.</li>
              <li>문장이 길다면 문단 단위로 나눠 입력하면 안정적입니다.</li>
              <li>발음이 중요한 고유명사는 한글로 풀어 적어주세요.</li>
            </ul>
          </section>

          <section className="bg-[#10221D] border border-[#25473E] rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-emerald-300 mb-4">2. 목소리 설정</h2>
            <ul className="space-y-2 text-neutral-300 list-disc list-inside">
              <li>원하는 목소리를 선택합니다.</li>
              <li>말하기 속도와 음높이를 조절해 톤을 맞춰주세요.</li>
              <li>짧은 문장으로 테스트 후 본문을 생성하는 것을 추천합니다.</li>
            </ul>
          </section>

          <section className="bg-[#10221D] border border-[#25473E] rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-emerald-300 mb-4">3. 생성 및 다운로드</h2>
            <ul className="space-y-2 text-neutral-300 list-disc list-inside">
              <li>"TTS 생성하기" 버튼을 누르면 오디오가 생성됩니다.</li>
              <li>생성된 음성은 페이지에서 바로 재생할 수 있습니다.</li>
              <li>MP3 다운로드로 영상 편집에 바로 활용하세요.</li>
            </ul>
          </section>

          <section className="bg-[#0E1E1A] border border-[#1C3A31] rounded-2xl p-6">
            <h2 className="text-xl font-bold text-emerald-200 mb-3">자주 사용하는 팁</h2>
            <ul className="space-y-2 text-emerald-100/80 list-disc list-inside">
              <li>속도를 낮추면 차분한, 높이면 역동적인 분위기가 됩니다.</li>
              <li>문장 끝에 쉼표를 넣어 호흡을 조절할 수 있습니다.</li>
              <li>최종 대본 확정 후 생성하면 수정 비용을 줄일 수 있습니다.</li>
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
};

export default TtsGuidePage;
