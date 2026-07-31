import { describe, expect, it } from "vitest";
import { createVaultPublicKeyRecord } from "../../src/server/vault/service";

describe("vault public key boundary", () => {
  it("stores only public vault material", () => {
    const record = createVaultPublicKeyRecord({
      userId: "user-1",
      publicKeyBytes: "x25519-public-key",
      algorithm: "DHKEM_X25519_HKDF_SHA256",
    });

    expect(record.ownerFingerprint).toHaveLength(64);
    expect(record).not.toHaveProperty("privateKey");
    expect(record).not.toHaveProperty("recoveryPhrase");
  });

  it("rejects private or recovery material", () => {
    expect(() =>
      createVaultPublicKeyRecord({
        userId: "user-1",
        publicKeyBytes: "x25519-public-key",
        algorithm: "DHKEM_X25519_HKDF_SHA256",
        privateKey: "secret",
      }),
    ).toThrow("public material only");
  });
});
