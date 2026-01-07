import type { VercelRequest } from "@vercel/node";
import { createHash } from "crypto";
import { supabaseAdmin } from "./supabase";

const HASH_SALT = process.env.ABUSE_HASH_SALT || "local_dev_salt";

const getClientIp = (req: VercelRequest): string | null => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded == "string" && forwarded.length > 0) {
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

const BLOCKED_ACTIONS = new Set([
  "generateNewPlan",
  "generateChapterOutline",
  "generateChapterScript",
]);

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

export const enforceAbusePolicy = async (
  req: VercelRequest,
  action: string,
  clientFingerprint?: string | null
) => {
  const ip = getClientIp(req);
  const ipHash = hashValue(ip);
  const fingerprintHash = hashValue(clientFingerprint || null);

  if (!ipHash && !fingerprintHash) {
    return { allowed: true };
  }

  let label: string | null = null;
  try {
    label = await fetchLatestRisk(ipHash, fingerprintHash);
  } catch (error) {
    console.error("Abuse policy lookup failed", error);
    return { allowed: true };
  }
  if (label == "abusive") {
    return { allowed: false, status: 403, reason: "abuse_blocked" };
  }

  if (label == "suspicious" && BLOCKED_ACTIONS.has(action)) {
    return { allowed: false, status: 429, reason: "abuse_limited" };
  }

  return { allowed: true };
};
