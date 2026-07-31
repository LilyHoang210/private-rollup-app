import type { RetentionCohort } from "./files";

export interface RecoveryReceipt {
  formatVersion: 1;
  network: string;
  driver: "local" | "shelbynet";
  blobId: string;
  blobName: string;
  byteStart: number;
  byteLength: number;
  ciphertextHash: string;
  ownerKeyFingerprint: string;
  wrappedDek: string;
  encryptedManifestRef: string;
  retentionDays: RetentionCohort;
  expiresAt: string;
  serviceSignature: string;
}
