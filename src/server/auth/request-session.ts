import {
  parseSessionToken,
  SESSION_COOKIE_NAME,
  type AuthenticatedSession,
} from "./session";

export function getAuthenticatedSession(request: Request): AuthenticatedSession | null {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  if (!token) {
    return null;
  }

  return parseSessionToken(token);
}

export function getAuthenticatedUserId(request: Request): string | null {
  const session = getAuthenticatedSession(request);

  return session ? `wallet:${session.walletAddressHash}` : null;
}

function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
}
