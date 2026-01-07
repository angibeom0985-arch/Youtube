import React from "react";
import { Link } from "react-router-dom";

const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16">
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.35em] text-red-400">
            Youtube Studio Tools
          </p>
          <h1 className="mt-4 text-4xl font-black sm:text-5xl">
            Choose Your Workflow
          </h1>
          <p className="mt-4 text-base text-neutral-300 sm:text-lg">
            Start with script writing or jump straight to image generation.
          </p>
        </div>

        <div className="mt-10 grid w-full gap-6 sm:grid-cols-2">
          <Link
            to="/script"
            className="group rounded-2xl border border-red-500/40 bg-gradient-to-br from-red-600/20 via-red-500/10 to-transparent p-6 transition duration-300 hover:-translate-y-1 hover:border-red-400 hover:bg-red-500/20"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-red-300">
                  Script
                </p>
                <h2 className="mt-2 text-2xl font-bold">
                  Script Writing
                </h2>
                <p className="mt-3 text-sm text-neutral-300">
                  Generate plans, outlines, and full scripts.
                </p>
              </div>
              <div className="text-2xl font-bold text-red-200">S</div>
            </div>
            <div className="mt-6 text-sm font-semibold text-red-200">
              Open Script Studio -&gt;
            </div>
          </Link>

          <Link
            to="/image"
            className="group rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-600/20 via-emerald-500/10 to-transparent p-6 transition duration-300 hover:-translate-y-1 hover:border-emerald-400 hover:bg-emerald-500/20"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">
                  Image
                </p>
                <h2 className="mt-2 text-2xl font-bold">
                  Image Generation
                </h2>
                <p className="mt-3 text-sm text-neutral-300">
                  Create visuals and storyboards for your scripts.
                </p>
              </div>
              <div className="text-2xl font-bold text-emerald-200">I</div>
            </div>
            <div className="mt-6 text-sm font-semibold text-emerald-200">
              Open Image Studio -&gt;
            </div>
          </Link>
        </div>

        <div className="mt-12 text-xs text-neutral-500">
          Tip: You can always switch between tools from the results screen.
        </div>
      </div>
    </div>
  );
};

export default HomePage;
