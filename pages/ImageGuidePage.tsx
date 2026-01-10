import React, { useEffect } from "react";
import { FiHome } from "react-icons/fi";

const ImageGuidePage: React.FC = () => {
  useEffect(() => {
    document.title = "이미지 생성 사용법 - 유튜브 영상 제작 AI";

    const updateMetaTag = (property: string, content: string) => {
      let meta = document.querySelector(`meta[property="${property}"]`);
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("property", property);
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    };

    updateMetaTag("og:title", "이미지 생성 사용법 - 유튜브 영상 제작 AI");
    updateMetaTag(
      "og:description",
      "캐릭터 설정부터 이미지 다운로드까지의 사용법을 정리했습니다."
    );
    updateMetaTag("og:image", "https://youtube.money-hotissue.com/og-image-guide.png");
    updateMetaTag("og:url", "https://youtube.money-hotissue.com/imgae/guide");
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0A12] text-white font-sans p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10">
          <a href="/image" className="inline-flex items-center gap-2 text-pink-300 hover:text-pink-200 mb-4">
            <FiHome size={18} />
            <span>이미지 생성으로 돌아가기</span>
          </a>
          <h1 className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-r from-[#FF4D8D] to-[#FF9068] bg-clip-text text-transparent">
            이미지 생성 사용법
          </h1>
          <p className="mt-3 text-neutral-300">
            캐릭터 설정과 스타일 선택부터 결과 저장까지의 흐름을 안내합니다.
          </p>
        </header>

        <main className="space-y-6">
          <section className="bg-[#151423] border border-[#2F2A38] rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-pink-300 mb-4">1. 캐릭터 설정</h2>
            <ul className="space-y-2 text-neutral-300 list-disc list-inside">
              <li>등장인물 특징을 자세히 입력하면 결과 퀄리티가 높아집니다.</li>
              <li>실사/애니메이션 스타일을 선택해 분위기를 맞춰주세요.</li>
              <li>참고 이미지가 있다면 업로드하여 방향성을 고정할 수 있습니다.</li>
            </ul>
          </section>

          <section className="bg-[#151423] border border-[#2F2A38] rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-pink-300 mb-4">2. 비율 및 스타일 선택</h2>
            <ul className="space-y-2 text-neutral-300 list-disc list-inside">
              <li>숏폼은 9:16, 일반 영상은 16:9를 추천합니다.</li>
              <li>스타일 프리셋으로 분위기와 색감을 손쉽게 통일할 수 있습니다.</li>
              <li>여러 스타일을 테스트해 가장 맞는 이미지를 찾으세요.</li>
            </ul>
          </section>

          <section className="bg-[#151423] border border-[#2F2A38] rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-pink-300 mb-4">3. 이미지 생성</h2>
            <ul className="space-y-2 text-neutral-300 list-disc list-inside">
              <li>생성 버튼을 누르면 선택한 옵션으로 이미지가 만들어집니다.</li>
              <li>결과가 마음에 들지 않으면 재생성으로 개선할 수 있습니다.</li>
              <li>장면별로 여러 장을 만들어 비교해 보세요.</li>
            </ul>
          </section>

          <section className="bg-[#151423] border border-[#2F2A38] rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-pink-300 mb-4">4. 다운로드 및 활용</h2>
            <ul className="space-y-2 text-neutral-300 list-disc list-inside">
              <li>개별 다운로드 또는 ZIP 묶음 저장이 가능합니다.</li>
              <li>썸네일, 컷신, SNS 홍보 이미지로 바로 활용할 수 있습니다.</li>
              <li>일관된 스타일을 유지하려면 동일한 설정을 재사용하세요.</li>
            </ul>
          </section>

          <section className="bg-[#1A0F1C] border border-[#3C2A3F] rounded-2xl p-6">
            <h2 className="text-xl font-bold text-pink-200 mb-3">추천 입력 팁</h2>
            <ul className="space-y-2 text-pink-100/80 list-disc list-inside">
              <li>배경, 시간대, 감정 등 상황 설명을 추가하면 디테일이 살아납니다.</li>
              <li>캐릭터 외형은 구체적인 키워드로 정리해 주세요.</li>
              <li>원하는 분위기를 2~3가지 형용사로 강조하세요.</li>
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
};

export default ImageGuidePage;
