import { describe, expect, it } from "vitest";
import { POST } from "../../src/app/api/vault/route";
import {
  createSessionCookie,
  createSessionToken,
} from "../../src/server/auth/session";

describe("vault API route", () => {
  it("accepts public key registration and rejects secrets", async () => {
    const ok = await POST(
      new Request("http://localhost/api/vault", {
        method: "POST",
        headers: authHeaders("b".repeat(64)),
        body: JSON.stringify({
          publicKeyBytes: "x25519-public-key",
          algorithm: "DHKEM_X25519_HKDF_SHA256",
        }),
      }),
    );

    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({
      algorithm: "DHKEM_X25519_HKDF_SHA256",
    });

    const rejected = await POST(
      new Request("http://localhost/api/vault", {
        method: "POST",
        headers: authHeaders("b".repeat(64)),
        body: JSON.stringify({
          publicKeyBytes: "x25519-public-key",
          algorithm: "DHKEM_X25519_HKDF_SHA256",
          recoveryPhrase: "secret",
        }),
      }),
    );

    expect(rejected.status).toBe(400);
  });

  it("requires a wallet session before registering vault material", async () => {
    const response = await POST(
      new Request("http://localhost/api/vault", {
        method: "POST",
        body: JSON.stringify({
          publicKeyBytes: "x25519-public-key",
          algorithm: "DHKEM_X25519_HKDF_SHA256",
        }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "AUTH_REQUIRED",
    });
  });
});

function authHeaders(walletAddressHash: string) {
  const token = createSessionToken({
    walletAddressHash,
    chainId: "aptos-shelbynet",
    maxAgeSeconds: 60,
    secret: "private-rollup-dev-session-secret",
  });
  const cookie = createSessionCookie({
    token,
    maxAgeSeconds: 60,
    secure: false,
  }).split(";")[0];

  return { Cookie: cookie };
}
