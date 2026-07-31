import { createHash, randomUUID } from "node:crypto";

export interface CreateVaultPublicKeyInput {
  userId: string;
  publicKeyBytes: string;
  algorithm: "DHKEM_X25519_HKDF_SHA256";
  privateKey?: unknown;
  recoveryPhrase?: unknown;
}

export interface VaultPublicKeyRecord {
  id: string;
  userId: string;
  publicKeyBytes: string;
  algorithm: "DHKEM_X25519_HKDF_SHA256";
  ownerFingerprint: string;
  createdAt: string;
}

export function createVaultPublicKeyRecord(
  input: CreateVaultPublicKeyInput,
): VaultPublicKeyRecord {
  if ("privateKey" in input || "recoveryPhrase" in input) {
    throw new Error("Vault registration accepts public material only");
  }

  if (!input.publicKeyBytes.trim()) {
    throw new Error("Vault public key is required");
  }

  const ownerFingerprint = createHash("sha256")
    .update(`${input.algorithm}:${input.publicKeyBytes}`, "utf8")
    .digest("hex");

  return {
    id: randomUUID(),
    userId: input.userId,
    publicKeyBytes: input.publicKeyBytes,
    algorithm: input.algorithm,
    ownerFingerprint,
    createdAt: new Date().toISOString(),
  };
}
