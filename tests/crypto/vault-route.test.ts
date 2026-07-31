import { describe, expect, it } from "vitest";
import { POST } from "../../src/app/api/vault/route";

describe("vault API route", () => {
  it("accepts public key registration and rejects secrets", async () => {
    const ok = await POST(
      new Request("http://localhost/api/vault", {
        method: "POST",
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
        body: JSON.stringify({
          publicKeyBytes: "x25519-public-key",
          algorithm: "DHKEM_X25519_HKDF_SHA256",
          recoveryPhrase: "secret",
        }),
      }),
    );

    expect(rejected.status).toBe(400);
  });
});
