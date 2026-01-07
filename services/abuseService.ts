export type AbuseLabel = "normal" | "suspicious" | "abusive";

export type AbuseDecision = {
  label: AbuseLabel;
  action?: "allow" | "limit" | "block";
  score?: number;
  reason?: string;
};

type ClientInfo = {
  ip?: string | null;
  userAgent: string;
  browser: string;
  os: string;
  fingerprint: string;
  fingerprintData: Record<string, unknown>;
};

const fingerprintStorageKey = "client_fingerprint";
const fingerprintDataStorageKey = "client_fingerprint_data";

const getBrowserName = (ua: string): string => {
  const uaLower = ua.toLowerCase();
  if (uaLower.includes("edg/")) return "Edge";
  if (uaLower.includes("opr/") || uaLower.includes("opera")) return "Opera";
  if (uaLower.includes("chrome")) return "Chrome";
  if (uaLower.includes("safari")) return "Safari";
  if (uaLower.includes("firefox")) return "Firefox";
  return "Other";
};

const getOsName = (ua: string): string => {
  const uaLower = ua.toLowerCase();
  if (uaLower.includes("windows")) return "Windows";
  if (uaLower.includes("mac os")) return "macOS";
  if (uaLower.includes("iphone") || uaLower.includes("ipad")) return "iOS";
  if (uaLower.includes("android")) return "Android";
  if (uaLower.includes("linux")) return "Linux";
  return "Other";
};

const toHex = (buffer: ArrayBuffer): string => {
  const bytes = Array.from(new Uint8Array(buffer));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
};

const hashString = async (input: string): Promise<string> => {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
};

const getFingerprintData = (): Record<string, unknown> => {
  return {
    language: navigator.language,
    languages: navigator.languages,
    platform: navigator.platform,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      colorDepth: window.screen.colorDepth,
      pixelRatio: window.devicePixelRatio,
    },
    hardwareConcurrency: navigator.hardwareConcurrency || null,
    deviceMemory: (navigator as any).deviceMemory || null,
    touchSupport: "ontouchstart" in window || navigator.maxTouchPoints > 0,
  };
};

const fetchPublicIp = async (): Promise<string | null> => {
  const cached = sessionStorage.getItem("client_ip");
  if (cached) return cached;

  try {
    const response = await fetch("https://api.ipify.org?format=json", {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { ip?: string };
    if (data.ip) {
      sessionStorage.setItem("client_ip", data.ip);
      return data.ip;
    }
  } catch (error) {
    // Ignore IP lookup errors; server will derive IP.
  }

  return null;
};

export const getClientFingerprint = async (): Promise<string> => {
  const cached = sessionStorage.getItem(fingerprintStorageKey);
  if (cached) return cached;

  const fingerprintData = getFingerprintData();
  const fingerprint = await hashString(JSON.stringify(fingerprintData));
  sessionStorage.setItem(fingerprintStorageKey, fingerprint);
  sessionStorage.setItem(fingerprintDataStorageKey, JSON.stringify(fingerprintData));
  return fingerprint;
};

export const collectClientInfo = async (): Promise<ClientInfo> => {
  const userAgent = navigator.userAgent || "";
  const browser = getBrowserName(userAgent);
  const os = getOsName(userAgent);
  const fingerprint = await getClientFingerprint();
  const cachedFingerprintData = sessionStorage.getItem(fingerprintDataStorageKey);
  const fingerprintData = cachedFingerprintData
    ? (JSON.parse(cachedFingerprintData) as Record<string, unknown>)
    : getFingerprintData();
  const ip = await fetchPublicIp();

  return {
    ip,
    userAgent,
    browser,
    os,
    fingerprint,
    fingerprintData,
  };
};

export const evaluateAbuseRisk = async (): Promise<AbuseDecision> => {
  const client = await collectClientInfo();

  const response = await fetch("/api/abuse/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "abuse_check_failed");
  }

  return (await response.json()) as AbuseDecision;
};
