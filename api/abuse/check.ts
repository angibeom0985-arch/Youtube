import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHash } from "crypto";
import { supabaseAdmin } from "../_lib/supabase.js";
import { classifyWithGroq } from "../_lib/groq.js";

const HASH_SALT = process.env.ABUSE_HASH_SALT || "local_dev_salt";
const LOOKBACK_MS = Number(process.env.ABUSE_LOOKBACK_MS || 24 * 60 * 60 * 1000);

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

const parseBody = (req: VercelRequest) => {
  if (!req.body) return null;
  if (typeof req.body == "string") {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      return null;
    }
  }
  return req.body;
};

const getCount = async (query: any): Promise<number> => {
  const { count, error } = await query;
  if (error) {
    throw error;
  }
  return count || 0;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method == "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method != "POST") {
    res.status(405).send("method_not_allowed");
    return;
  }

  const body = parseBody(req);
  if (!body?.client) {
    res.status(400).send("missing_client");
    return;
  }

  const clientIp = getClientIp(req);
  const reportedIp = body.client.ip || null;
  const ipForHash = clientIp || reportedIp;
  const ipHash = hashValue(ipForHash);

  const fingerprint = body.client.fingerprint || null;
  const fingerprintHash = hashValue(fingerprint);

  const eventPayload = {
    ip: clientIp,
    reported_ip: reportedIp,
    ip_hash: ipHash,
    user_agent: body.client.userAgent || "",
    browser: body.client.browser || "",
    os: body.client.os || "",
    fingerprint,
    fingerprint_hash: fingerprintHash,
    fingerprint_data: body.client.fingerprintData || {},
    risk_label: "pending",
  };

  const { data: createdEvent, error: insertError } = await supabaseAdmin
    .from("abuse_events")
    .insert(eventPayload)
    .select("id")
    .single();

  if (insertError || !createdEvent) {
    console.error("Failed to insert abuse event", insertError);
    res.status(500).send("storage_error");
    return;
  }

  const since = new Date(Date.now() - LOOKBACK_MS).toISOString();

  try {
    const eventsByIp24h = ipHash
      ? await getCount(
          supabaseAdmin
            .from("abuse_events")
            .select("id", { count: "exact", head: true })
            .eq("ip_hash", ipHash)
            .gte("created_at", since)
        )
      : 0;
    const eventsByFingerprint24h = fingerprintHash
      ? await getCount(
          supabaseAdmin
            .from("abuse_events")
            .select("id", { count: "exact", head: true })
            .eq("fingerprint_hash", fingerprintHash)
            .gte("created_at", since)
        )
      : 0;
    const totalEvents24h = await getCount(
      supabaseAdmin
        .from("abuse_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since)
    );

    const metrics = {
      eventsByIp24h,
      eventsByFingerprint24h,
      totalEvents24h,
    };

    const groqResult = await classifyWithGroq({
      ipHash,
      userAgent: body.client.userAgent || "",
      browser: body.client.browser || "",
      os: body.client.os || "",
      fingerprintHash,
      metrics,
    });

    const decision = groqResult.decision;
    const action =
      decision.label == "normal"
        ? "allow"
        : decision.label == "suspicious"
          ? "limit"
          : "block";

    await supabaseAdmin
      .from("abuse_events")
      .update({
        risk_label: decision.label,
        risk_score: decision.score,
        risk_reason: decision.reason,
        decision_source: groqResult.source,
        decision_payload: groqResult.raw,
        metrics,
        action,
      })
      .eq("id", createdEvent.id);

    res.status(200).json({
      label: decision.label,
      score: decision.score,
      reason: decision.reason,
      action,
    });
  } catch (error) {
    console.error("Abuse check failed", error);

    await supabaseAdmin
      .from("abuse_events")
      .update({
        risk_label: "unknown",
        risk_reason: "processing_failed",
      })
      .eq("id", createdEvent.id);

    res.status(500).send("analysis_error");
  }
}
