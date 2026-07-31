import { createHash, randomBytes } from "node:crypto";

const SESSION_COOKIE_NAME = "pr_session";

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createSessionCookie(input: {
  token: string;
  maxAgeSeconds: number;
  secure: boolean;
}) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(input.token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${input.maxAgeSeconds}`,
  ];

  if (input.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}
