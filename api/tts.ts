import type { VercelRequest, VercelResponse } from "@vercel/node";
import { enforceUsageLimit, recordUsageEvent } from "./_lib/usageLimit.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send("method_not_allowed");
    return;
  }

  let body: any = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).send("invalid_json");
      return;
    }
  }

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const voice = typeof body?.voice === "string" ? body.voice : "ko-KR-Standard-A";
  const speakingRate =
    typeof body?.speakingRate === "number" ? body.speakingRate : 1;
  const pitch = typeof body?.pitch === "number" ? body.pitch : 0;
  const clientFingerprint =
    typeof body?.client?.fingerprint === "string" ? body.client.fingerprint : null;

  if (!text) {
    res.status(400).json({ message: "missing_fields" });
    return;
  }

  const apiKey =
    process.env.GOOGLE_TTS_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_API_KEY ||
    "";
  if (!apiKey) {
    res.status(500).json({ message: "missing_api_key" });
    return;
  }

  const usage = await enforceUsageLimit(req, clientFingerprint);
  if (!usage.allowed) {
    if (usage.retryAfterSeconds) {
      res.setHeader("Retry-After", usage.retryAfterSeconds.toString());
    }
    res.status(usage.status || 429).json({ message: usage.reason || "usage_limit" });
    return;
  }

  await recordUsageEvent(req, "tts", clientFingerprint);

  const languageMatch = voice.match(/^[a-z]{2}-[A-Z]{2}/);
  const languageCode = languageMatch ? languageMatch[0] : "ko-KR";

  try {
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode, name: voice },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate,
            pitch,
          },
        }),
      }
    );

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        payload?.error?.message || "tts_failed";
      res.status(response.status).json({ message });
      return;
    }

    if (!payload?.audioContent) {
      res.status(500).json({ message: "missing_audio" });
      return;
    }

    res.status(200).json({ audioContent: payload.audioContent });
  } catch (error: any) {
    console.error("[api/tts] error:", error);
    res.status(500).json({ message: error?.message || "server_error" });
  }
}
