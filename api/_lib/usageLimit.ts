import type { VercelRequest } from "@vercel/node";
import { createHash } from "crypto";
import { supabaseAdmin } from "./supabase";

const HASH_SALT = process.env.ABUSE_HASH_SALT || "local_dev_salt";

const DAILY_LIMIT = 5;
const PER_MINUTE_LIMIT = 3;
const SUSPICIOUS_DAILY_LIMIT = 1;

const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const MINUTE_WINDOW_MS = 60 * 1000;

const getClientIp = (req: VercelRequest): string | null => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.socket?.remoteAddress || null;
};

const hashValue = (value: string | null): string | null => {
  if (!value) return null;
  return createHash("sha256").update(`${value}:${HASH_SALT}`).digest("hex");
};

const getCount = async (query: any): Promise<number> => {
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
};

const fetchLatestRisk = async (ipHash: string | null, fingerprintHash: string | null) => {
  const candidates: Array<{ risk_label: string | null; created_at: string }> = [];

  if (ipHash) {
    const { data } = await supabaseAdmin
      .from("abuse_events")
      .select("risk_label, created_at")
      .eq("ip_hash", ipHash)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) candidates.push(data);
  }

  if (fingerprintHash) {
    const { data } = await supabaseAdmin
      .from("abuse_events")
      .select("risk_label, created_at")
      .eq("fingerprint_hash", fingerprintHash)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) candidates.push(data);
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return candidates[0].risk_label || null;
};

export type UsageLimitResult = {
  allowed: boolean;
  status?: number;
  reason?: string;
  retryAfterSeconds?: number;
  limits?: { daily: number; perMinute: number };
};

export const enforceUsageLimit = async (
  req: VercelRequest,
  clientFingerprint?: string | null
): Promise<UsageLimitResult> => {
  const ip = getClientIp(req);
  const ipHash = hashValue(ip);
  const fingerprintHash = hashValue(clientFingerprint || null);

  if (!ipHash && !fingerprintHash) {
    return { allowed: true, limits: { daily: DAILY_LIMIT, perMinute: PER_MINUTE_LIMIT } };
  }

  let label: string | null = null;
  try {
    label = await fetchLatestRisk(ipHash, fingerprintHash);
  } catch (error) {
    console.error("Usage limit risk lookup failed", error);
    return { allowed: true, limits: { daily: DAILY_LIMIT, perMinute: PER_MINUTE_LIMIT } };
  }

  if (label === "abusive") {
    return { allowed: false, status: 403, reason: "abuse_blocked" };
  }

  const dailyLimit = label === "suspicious" ? SUSPICIOUS_DAILY_LIMIT : DAILY_LIMIT;
  const perMinuteLimit = PER_MINUTE_LIMIT;

  const now = Date.now();
  const dailySince = new Date(now - DAILY_WINDOW_MS).toISOString();
  const minuteSince = new Date(now - MINUTE_WINDOW_MS).toISOString();

  let dailyQuery = supabaseAdmin
    .from("gemini_usage")
    .select("id", { count: "exact", head: true })
    .gte("created_at", dailySince);
  let minuteQuery = supabaseAdmin
    .from("gemini_usage")
    .select("id", { count: "exact", head: true })
    .gte("created_at", minuteSince);

  if (ipHash && fingerprintHash) {
    const filter = `ip_hash.eq.${ipHash},fingerprint_hash.eq.${fingerprintHash}`;
    dailyQuery = dailyQuery.or(filter);
    minuteQuery = minuteQuery.or(filter);
  } else if (ipHash) {
    dailyQuery = dailyQuery.eq("ip_hash", ipHash);
    minuteQuery = minuteQuery.eq("ip_hash", ipHash);
  } else if (fingerprintHash) {
    dailyQuery = dailyQuery.eq("fingerprint_hash", fingerprintHash);
    minuteQuery = minuteQuery.eq("fingerprint_hash", fingerprintHash);
  }

  try {
    const dailyCount = await getCount(dailyQuery);
    if (dailyCount >= dailyLimit) {
      return { allowed: false, status: 429, reason: "daily_limit" };
    }

    const minuteCount = await getCount(minuteQuery);
    if (minuteCount >= perMinuteLimit) {
      return {
        allowed: false,
        status: 429,
        reason: "minute_limit",
        retryAfterSeconds: Math.ceil(MINUTE_WINDOW_MS / 1000),
      };
    }
  } catch (error) {
    console.error("Usage limit count failed", error);
    return { allowed: true, limits: { daily: dailyLimit, perMinute: perMinuteLimit } };
  }

  return { allowed: true, limits: { daily: dailyLimit, perMinute: perMinuteLimit } };
};

export const recordUsageEvent = async (
  req: VercelRequest,
  action: string,
  clientFingerprint?: string | null
) => {
  const ip = getClientIp(req);
  const ipHash = hashValue(ip);
  const fingerprintHash = hashValue(clientFingerprint || null);
  const userAgent = req.headers["user-agent"] || "";

  const payload = {
    action,
    ip,
    ip_hash: ipHash,
    fingerprint: clientFingerprint || null,
    fingerprint_hash: fingerprintHash,
    user_agent: userAgent,
  };

  const { error } = await supabaseAdmin.from("gemini_usage").insert(payload);
  if (error) {
    console.error("Failed to store usage event", error);
  }
};
