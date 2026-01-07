import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase.js";
import { requireAdmin } from "../_lib/adminAuth.js";

const normalizeLabel = (value: string | string[] | undefined) => {
  if (typeof value !== "string") return null;
  if (!["normal", "suspicious", "abusive", "pending", "unknown"].includes(value)) {
    return null;
  }
  return value;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  const admin = requireAdmin(req);
  if (!admin) {
    res.status(401).send("unauthorized");
    return;
  }

  const limitParam = typeof req.query.limit === "string" ? Number(req.query.limit) : 100;
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 100;
  const label = normalizeLabel(req.query.label);
  const since = typeof req.query.since === "string" ? req.query.since : null;

  let query = supabaseAdmin
    .from("abuse_events")
    .select(
      "id, created_at, ip, reported_ip, ip_hash, user_agent, browser, os, fingerprint_hash, risk_label, risk_score, risk_reason, action"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (label) {
    query = query.eq("risk_label", label);
  }
  if (since) {
    query = query.gte("created_at", since);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Admin fetch failed", error);
    res.status(500).send("query_error");
    return;
  }

  const summary = {
    normal: 0,
    suspicious: 0,
    abusive: 0,
    pending: 0,
    unknown: 0,
  };

  (data || []).forEach((row: any) => {
    const labelValue = row.risk_label || "unknown";
    if (labelValue in summary) {
      summary[labelValue as keyof typeof summary] += 1;
    } else {
      summary.unknown += 1;
    }
  });

  res.status(200).json({ summary, events: data || [] });
}
