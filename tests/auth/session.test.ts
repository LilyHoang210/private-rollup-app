import { describe, expect, it } from "vitest";
import { createSessionCookie } from "../../src/server/auth/session";

describe("session cookie policy", () => {
  it("uses HttpOnly, Secure in production, and SameSite=Lax", () => {
    const cookie = createSessionCookie({
      token: "session-token",
      maxAgeSeconds: 3600,
      secure: true,
    });

    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("session-token=");
  });
});
