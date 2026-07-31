import { describe, expect, it } from "vitest";
import {
  generateVaultKeyPair,
  importVaultPublicKey,
  unwrapDekForVault,
  wrapDekForVault,
} from "../../src/client/crypto/hpke";

describe("HPKE DEK wrapping", () => {
  const dek = new Uint8Array(32).fill(11);
  const aad = new TextEncoder().encode("private-rollup:receipt:local-file-1");

  it("wraps and unwraps a file DEK for a vault public key", async () => {
    const vaultKeyPair = await generateVaultKeyPair();
    const recipientPublicKey = await importVaultPublicKey(vaultKeyPair.publicKeyBytes);

    const wrapped = await wrapDekForVault({
      dek,
      recipientPublicKey,
      aad,
    });

    expect(wrapped.suite).toBe("DHKEM_X25519_HKDF_SHA256_HKDF_SHA256_AES_256_GCM");
    expect(wrapped.enc.byteLength).toBeGreaterThan(0);
    expect(wrapped.ciphertext.byteLength).toBeGreaterThan(dek.byteLength);
    expect(wrapped.ciphertext).not.toEqual(dek);

    await expect(
      unwrapDekForVault({
        wrapped,
        recipientPrivateKey: vaultKeyPair.privateKey,
        aad,
      }),
    ).resolves.toEqual(dek);
  });

  it("binds wrapped DEKs to receipt AAD", async () => {
    const vaultKeyPair = await generateVaultKeyPair();
    const wrapped = await wrapDekForVault({
      dek,
      recipientPublicKey: vaultKeyPair.publicKey,
      aad,
    });

    await expect(
      unwrapDekForVault({
        wrapped,
        recipientPrivateKey: vaultKeyPair.privateKey,
        aad: new TextEncoder().encode("private-rollup:receipt:tampered"),
      }),
    ).rejects.toThrow();
  });

  it("returns only public serialized vault key material", async () => {
    const vaultKeyPair = await generateVaultKeyPair();

    expect(vaultKeyPair.publicKeyBytes.byteLength).toBeGreaterThanOrEqual(32);
    expect("privateKeyBytes" in vaultKeyPair).toBe(false);
  });
});
