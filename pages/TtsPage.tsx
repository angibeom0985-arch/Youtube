import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const STORAGE_KEYS = {
  text: "tts_text",
  voice: "tts_voice",
  rate: "tts_rate",
  pitch: "tts_pitch",
  audio: "tts_audio",
  error: "tts_error",
};

const getStoredString = (key: string, fallback = ""): string => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch (error) {
    console.error("TTS 로컬 저장값을 불러오지 못했습니다:", error);
    return fallback;
  }
};

const getStoredNumber = (key: string, fallback: number): number => {
  const value = getStoredString(key, "");
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const setStoredValue = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error("TTS 로컬 저장값을 저장하지 못했습니다:", error);
  }
};

const voiceOptions = [
  { value: "ko-KR-Standard-A", label: "한국어 표준 여성 (A)" },
  { value: "ko-KR-Standard-C", label: "한국어 표준 남성 (C)" },
  { value: "ko-KR-Standard-D", label: "한국어 표준 여성 (D)" },
  { value: "en-US-Standard-C", label: "영어 표준 여성 (C)" },
];

const TtsPage: React.FC = () => {
  const [text, setText] = useState(() => getStoredString(STORAGE_KEYS.text));
  const [voice, setVoice] = useState(() =>
    getStoredString(STORAGE_KEYS.voice, "ko-KR-Standard-A")
  );
  const [speakingRate, setSpeakingRate] = useState(() =>
    getStoredNumber(STORAGE_KEYS.rate, 1)
  );
  const [pitch, setPitch] = useState(() => getStoredNumber(STORAGE_KEYS.pitch, 0));
  const [audioSrc, setAudioSrc] = useState(() => getStoredString(STORAGE_KEYS.audio));
  const [error, setError] = useState(() => getStoredString(STORAGE_KEYS.error));
  const [isGenerating, setIsGenerating] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");


  useEffect(() => setStoredValue(STORAGE_KEYS.text, text), [text]);
  useEffect(() => setStoredValue(STORAGE_KEYS.voice, voice), [voice]);
  useEffect(() => setStoredValue(STORAGE_KEYS.rate, String(speakingRate)), [speakingRate]);
  useEffect(() => setStoredValue(STORAGE_KEYS.pitch, String(pitch)), [pitch]);
  useEffect(() => setStoredValue(STORAGE_KEYS.audio, audioSrc), [audioSrc]);
  useEffect(() => setStoredValue(STORAGE_KEYS.error, error), [error]);

  const handleReset = () => {
    setText("");
    setVoice("ko-KR-Standard-A");
    setSpeakingRate(1);
    setPitch(0);
    setAudioSrc("");
    setError("");
    setCopyStatus("");
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError("변환할 텍스트를 입력해 주세요.");
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice,
          speakingRate,
          pitch,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          payload?.message || "TTS 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.";
        setError(message);
        setAudioSrc("");
        setCopyStatus("");
        return;
      }

      if (!payload?.audioContent) {
        setError("오디오 응답을 받지 못했습니다. 다시 시도해 주세요.");
        setAudioSrc("");
        setCopyStatus("");
        return;
      }

      setAudioSrc(`data:audio/mp3;base64,${payload.audioContent}`);
      setCopyStatus("");
    } catch (err) {
      console.error("TTS 요청 실패:", err);
      setError("요청 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      setAudioSrc("");
      setCopyStatus("");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyError = async () => {
    if (!error) {
      return;
    }

    try {
      await navigator.clipboard.writeText(error);
      setCopyStatus("오류 메시지가 복사되었습니다.");
    } catch (copyError) {
      console.error("오류 메시지 복사 실패:", copyError);
      setCopyStatus("오류 메시지 복사에 실패했습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900/60 via-slate-900/70 to-emerald-800/60 text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-emerald-200 hover:text-emerald-100"
            >
              ← 홈으로
            </Link>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">
              TTS 음성 제작
            </h1>
            <p className="mt-3 text-sm text-emerald-100/80 sm:text-base">
              API 키는 서버에서 자동으로 사용됩니다. 텍스트만 입력해 주세요.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-full border border-emerald-300/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-200 hover:bg-emerald-500/25"
          >
            초기화
          </button>
        </div>

        <div className="mt-8 rounded-2xl border border-emerald-400/30 bg-emerald-950/30 p-6 shadow-[0_0_30px_rgba(16,185,129,0.18)]">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-emerald-200">
                  변환할 텍스트
                </label>
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="예) 여러분 안녕하세요. 오늘은..."
                  rows={8}
                  className="mt-2 w-full resize-y rounded-lg border border-emerald-500/30 bg-emerald-950/50 px-3 py-2 text-sm text-white placeholder:text-emerald-200/60 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-emerald-200">
                  목소리 선택
                </label>
                <select
                  value={voice}
                  onChange={(event) => setVoice(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-emerald-500/30 bg-emerald-950/50 px-3 py-2 text-sm text-white focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                >
                  {voiceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-emerald-200">
                  말하기 속도: {speakingRate.toFixed(2)}
                </label>
                <input
                  type="range"
                  min={0.7}
                  max={1.3}
                  step={0.05}
                  value={speakingRate}
                  onChange={(event) => setSpeakingRate(Number(event.target.value))}
                  className="mt-3 w-full accent-emerald-400"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-emerald-200">
                  음높이: {pitch.toFixed(1)}
                </label>
                <input
                  type="range"
                  min={-6}
                  max={6}
                  step={0.5}
                  value={pitch}
                  onChange={(event) => setPitch(Number(event.target.value))}
                  className="mt-3 w-full accent-emerald-400"
                />
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="mt-2 w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-[0_0_18px_rgba(16,185,129,0.25)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isGenerating ? "음성 생성 중..." : "TTS 생성하기"}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/60 bg-red-950/50 p-4 text-sm text-red-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-semibold text-red-100">오류 메시지</span>
              <button
                type="button"
                onClick={handleCopyError}
                className="rounded-full border border-red-400/60 bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-100 transition hover:border-red-300 hover:bg-red-500/30"
              >
                복사
              </button>
            </div>
            <pre className="mt-3 whitespace-pre-wrap break-words text-sm text-red-100">
              {error}
            </pre>
            {copyStatus && (
              <p className="mt-3 text-xs text-red-100/80">{copyStatus}</p>
            )}
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-emerald-400/25 bg-emerald-950/25 p-6">
          <h2 className="text-lg font-bold text-emerald-200">생성 결과</h2>
          {audioSrc ? (
            <div className="mt-4 space-y-4">
              <audio controls className="w-full">
                <source src={audioSrc} type="audio/mpeg" />
              </audio>
              <a
                href={audioSrc}
                download="youtube-factory-tts.mp3"
                className="inline-flex items-center justify-center rounded-lg border border-emerald-400/50 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300 hover:bg-emerald-500/25"
              >
                MP3 다운로드
              </a>
            </div>
          ) : (
            <p className="mt-3 text-sm text-emerald-100/70">
              아직 생성된 음성이 없습니다. 텍스트를 입력한 뒤 TTS 생성하기를 눌러주세요.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TtsPage;
