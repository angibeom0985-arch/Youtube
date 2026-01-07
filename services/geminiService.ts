import type { AnalysisResult, NewPlan } from "../types";
import { getClientFingerprint } from "./abuseService";

type GeminiAction =
  | "analyzeTranscript"
  | "generateIdeas"
  | "generateNewPlan"
  | "generateChapterOutline"
  | "generateChapterScript";

const toUserMessage = (raw: string): string => {
  const text = (raw || "").trim();
  const lower = text.toLowerCase();

  if (lower.includes("rate_limit")) {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
  }
  if (lower.includes("missing_api_key")) {
    return "서버 설정 오류가 발생했습니다. 관리자에게 문의해주세요.";
  }
  if (lower.includes("missing_fields") || lower.includes("invalid_request")) {
    return "요청 데이터가 올바르지 않습니다. 입력값을 확인해주세요.";
  }
  if (lower.includes("invalid_json")) {
    return "요청 데이터 형식이 올바르지 않습니다. 다시 시도해주세요.";
  }
  if (!text || lower.includes("server_error")) {
    return "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }

  return text;
};

const callGemini = async <T>(action: GeminiAction, payload: Record<string, unknown>): Promise<T> => {
  let clientPayload: { fingerprint: string } | undefined;
  try {
    const fingerprint = await getClientFingerprint();
    clientPayload = { fingerprint };
  } catch (error) {
    clientPayload = undefined;
  }

  const response = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload, client: clientPayload }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(toUserMessage(errorText));
  }

  return (await response.json()) as T;
};

export const analyzeTranscript = async (
  transcript: string,
  category: string,
  _apiKey: string,
  videoTitle?: string
): Promise<AnalysisResult> => {
  return callGemini<AnalysisResult>("analyzeTranscript", {
    transcript,
    category,
    videoTitle,
  });
};

export const generateIdeas = async (
  analysis: AnalysisResult,
  category: string,
  _apiKey: string,
  userKeyword?: string
): Promise<string[]> => {
  const data = await callGemini<{ ideas: string[] }>("generateIdeas", {
    analysis,
    category,
    userKeyword,
  });
  return data.ideas;
};

export const generateNewPlan = async (
  analysis: AnalysisResult,
  newKeyword: string,
  length: string,
  category: string,
  _apiKey: string,
  vlogType?: string
): Promise<NewPlan> => {
  return callGemini<NewPlan>("generateNewPlan", {
    analysis,
    newKeyword,
    length,
    category,
    vlogType,
  });
};
