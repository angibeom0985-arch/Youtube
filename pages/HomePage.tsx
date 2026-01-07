import React from "react";
import { Link } from "react-router-dom";

interface HomePageProps {
  basePath?: string;
}

const HomePage: React.FC<HomePageProps> = ({ basePath = "" }) => {
  const normalizedBasePath = basePath && basePath !== "/" ? basePath.replace(/\/$/, "") : "";
  const scriptPath = `${normalizedBasePath}/script` || "/script";
  const imagePath = `${normalizedBasePath}/image` || "/image";

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16">
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.35em] text-red-400">
            유튜브 팩토리
          </p>
          <h1 className="mt-4 text-4xl font-black sm:text-5xl">
            원하는 기능을 선택하세요
          </h1>
          <p className="mt-4 text-base text-neutral-300 sm:text-lg">
            대본 생성부터 시작하거나 이미지 생성으로 바로 이동할 수 있습니다.
          </p>
        </div>

        <div className="mt-10 grid w-full gap-6 sm:grid-cols-2">
          <Link
            to={scriptPath}
            className="group rounded-2xl border border-red-500/40 bg-gradient-to-br from-red-600/20 via-red-500/10 to-transparent p-6 transition duration-300 hover:-translate-y-1 hover:border-red-400 hover:bg-red-500/20"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="mt-2 text-2xl font-bold">
                  대본 생성
                </h2>
                <p className="mt-3 text-sm text-neutral-300">
                  떡상한 영상의 대본을 분석한 다음, 그걸 토대로 내 영상의 대본으로 만들어드립니다.
                </p>
              </div>
            </div>
            <div className="mt-6 text-sm font-semibold text-red-200">
              대본 생성 시작하기 -&gt;
            </div>
          </Link>

          <Link
            to={imagePath}
            className="group rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-600/20 via-emerald-500/10 to-transparent p-6 transition duration-300 hover:-translate-y-1 hover:border-emerald-400 hover:bg-emerald-500/20"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="mt-2 text-2xl font-bold">
                  이미지 생성
                </h2>
                <p className="mt-3 text-sm text-neutral-300">
                  대본에 맞는 이미지와 스토리보드를 제작합니다.
                </p>
              </div>
            </div>
            <div className="mt-6 text-sm font-semibold text-emerald-200">
              이미지 생성 시작하기 -&gt;
            </div>
          </Link>
        </div>

        <div className="mt-12 text-xs text-neutral-500">
          안내: 결과 화면에서도 언제든 다른 기능으로 이동할 수 있습니다.
        </div>
      </div>
    </div>
  );
};

export default HomePage;
