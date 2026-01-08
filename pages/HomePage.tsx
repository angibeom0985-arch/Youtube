import React from "react";
import { Link } from "react-router-dom";

interface HomePageProps {
  basePath?: string;
}

const HomePage: React.FC<HomePageProps> = ({ basePath = "" }) => {
  const normalizedBasePath = basePath && basePath != "/" ? basePath.replace(/\/$/, "") : "";
  const scriptPath = `${normalizedBasePath}/script` || "/script";
  const imagePath = `${normalizedBasePath}/image` || "/image";
  const ttsPath = `${normalizedBasePath}/tts` || "/tts";

  const scriptCardStyle = {
    borderColor: "var(--tone-image-orange)",
    background:
      "linear-gradient(135deg, rgba(var(--tone-image-orange-rgb),0.38), rgba(var(--tone-image-orange-rgb),0.16) 48%, transparent 100%)",
  } as React.CSSProperties;

  const imageCardStyle = {
    borderColor: "var(--tone-image-blue)",
    background:
      "linear-gradient(135deg, rgba(var(--tone-image-blue-rgb),0.35), rgba(var(--tone-image-blue-rgb),0.14) 48%, transparent 100%)",
  } as React.CSSProperties;

  const ttsCardStyle = {
    borderColor: "var(--tone-image-green)",
    background:
      "linear-gradient(135deg, rgba(var(--tone-image-green-rgb),0.32), rgba(var(--tone-image-green-rgb),0.12) 48%, transparent 100%)",
  } as React.CSSProperties;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-16">
        <div className="text-center">
          <p className="text-5xl font-black tracking-[0.08em] text-[color:var(--tone-script-red-strong)] sm:text-6xl lg:text-7xl">
            유튜브 팩토리
          </p>
          <h1 className="mt-6 text-3xl font-bold sm:text-4xl">
            원하는 기능을 선택하세요
          </h1>
          <p className="mt-4 text-base text-slate-200/80 sm:text-lg">
            대본 생성부터 시작하거나 이미지·TTS 생성으로 바로 이동할 수 있습니다.
          </p>
        </div>

        <div className="mt-12 grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to={scriptPath}
            style={scriptCardStyle}
            className="group rounded-2xl border p-6 transition duration-300 hover:-translate-y-1"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="mt-2 text-2xl font-bold">
                  대본 생성
                </h2>
                <p className="mt-3 text-sm text-slate-100/80">
                  떡상한 영상의 대본을 분석한 다음, 그걸 토대로 내 영상의 대본으로 만들어드립니다.
                </p>
              </div>
            </div>
            <div className="mt-6 text-sm font-semibold">
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-black"
                style={{ backgroundColor: "var(--tone-image-orange)" }}
              >
                대본 생성 시작하기 -&gt;
              </span>
            </div>
          </Link>

          <Link
            to={imagePath}
            style={imageCardStyle}
            className="group rounded-2xl border p-6 transition duration-300 hover:-translate-y-1"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="mt-2 text-2xl font-bold">
                  이미지 생성
                </h2>
                <p className="mt-3 text-sm text-slate-100/80">
                  대본에 맞는 이미지와 스토리보드를 제작합니다.
                </p>
              </div>
            </div>
            <div className="mt-6 text-sm font-semibold">
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-black"
                style={{ backgroundColor: "var(--tone-image-blue)" }}
              >
                이미지 생성 시작하기 -&gt;
              </span>
            </div>
          </Link>

          <Link
            to={ttsPath}
            style={ttsCardStyle}
            className="group rounded-2xl border p-6 transition duration-300 hover:-translate-y-1"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="mt-2 text-2xl font-bold">
                  TTS 생성
                </h2>
                <p className="mt-3 text-sm text-slate-100/80">
                  대본을 음성으로 변환해 나레이션을 빠르게 제작합니다.
                </p>
              </div>
            </div>
            <div className="mt-6 text-sm font-semibold">
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-black"
                style={{ backgroundColor: "var(--tone-image-green)" }}
              >
                TTS 생성 시작하기 -&gt;
              </span>
            </div>
          </Link>
        </div>

        <div className="mt-12 text-xs text-slate-400/80">
          안내: 결과 화면에서도 언제든 다른 기능으로 이동할 수 있습니다.
        </div>
      </div>
    </div>
  );
};

export default HomePage;
