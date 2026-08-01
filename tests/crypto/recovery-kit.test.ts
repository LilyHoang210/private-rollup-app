import { describe, expect, it } from "vitest";
import {
  createRecoveryKit,
  importRecoveryKitKeyPair,
  unwrapDekForVault,
  wrapDekForVault,
} from "../../src/client/crypto/hpke";

describe("recovery kit", () => {
  it("exports and imports the X25519 private key needed to recover a DEK", async () => {
    const kit = await createRecoveryKit();
    const imported = await importRecoveryKitKeyPair(kit);
    const dek = new Uint8Array(32).fill(23);
    const aad = new TextEncoder().encode("private-rollup:file:file-1");
    const wrapped = await wrapDekForVault({
      dek,
      recipientPublicKey: imported.publicKey,
      aad,
    });

    await expect(
      unwrapDekForVault({
        wrapped,
        recipientPrivateKey: imported.privateKey,
        aad,
      }),
    ).resolves.toEqual(dek);
    expect(kit.format).toBe("private-rollup-recovery-kit");
    expect(kit.privateKey).not.toBe(kit.publicKey);
    expect(kit.ownerFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });
});
