import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const SESSION_COOKIE_NAME = "pr_session";
const DEFAULT_SESSION_SECRET = "private-rollup-dev-session-secret";

export interface AuthenticatedSession {
  walletAddress?: string;
  walletAddressHash: string;
  chainId: string;
  expiresAt: Date;
}

export function createSessionToken(input: {
  walletAddress?: string;
  walletAddressHash: string;
  chainId: string;
  maxAgeSeconds: number;
  now?: Date;
  secret?: string;
}) {
  const now = input.now ?? new Date();
  const payload = {
    version: 1,
    walletAddress: input.walletAddress,
    walletAddressHash: input.walletAddressHash,
    chainId: input.chainId,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + input.maxAgeSeconds * 1000).toISOString(),
    nonce: randomBytes(16).toString("base64url"),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = signSessionPayload(encodedPayload, input.secret);

  return `${encodedPayload}.${signature}`;
}

export function parseSessionToken(
  token: string,
  options: { now?: Date; secret?: string } = {},
): AuthenticatedSession | null {
  const [encodedPayload, signature, extra] = token.split(".");
  if (!encodedPayload || !signature || extra) {
    return null;
  }

  if (!isEqualSignature(signature, signSessionPayload(encodedPayload, options.secret))) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<{
      walletAddress: unknown;
      walletAddressHash: unknown;
      chainId: unknown;
      expiresAt: unknown;
    }>;

    if (
      typeof payload.walletAddressHash !== "string" ||
      typeof payload.chainId !== "string" ||
      typeof payload.expiresAt !== "string"
    ) {
      return null;
    }

    const expiresAt = new Date(payload.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      return null;
    }

    if (expiresAt <= (options.now ?? new Date())) {
      return null;
    }

    return {
      walletAddress:
        typeof payload.walletAddress === "string" ? payload.walletAddress : undefined,
      walletAddressHash: payload.walletAddressHash,
      chainId: payload.chainId,
      expiresAt,
    };
  } catch {
    return null;
  }
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

export function createExpiredSessionCookie(input: { secure: boolean }) {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];

  if (input.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function signSessionPayload(encodedPayload: string, secret?: string) {
  return createHmac("sha256", sessionSecret(secret))
    .update(encodedPayload, "utf8")
    .digest("base64url");
}

function sessionSecret(secret?: string) {
  return secret ?? process.env.AUTH_SESSION_SECRET ?? DEFAULT_SESSION_SECRET;
}

function isEqualSignature(left: string, right: string) {
  const leftBytes = Buffer.from(left, "base64url");
  const rightBytes = Buffer.from(right, "base64url");

  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}
