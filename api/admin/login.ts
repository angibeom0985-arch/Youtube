import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  createSessionToken,
  setSessionCookie,
  validateAdminCredentials,
} from "../_lib/adminAuth.js";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send("method_not_allowed");
    return;
  }

  const body = parseBody(req);
  const username = body?.username || "";
  const password = body?.password || "";

  try {
    const isValid = validateAdminCredentials(username, password);
    if (!isValid) {
      res.status(401).send("invalid_credentials");
      return;
    }

    const token = createSessionToken(username);
    setSessionCookie(res, token);
    res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error("Admin login failed", error);
    res.status(500).send("login_error");
  }
}
