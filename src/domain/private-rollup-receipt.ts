import type { FileCategory, RetentionCohort } from "./files";

export interface PrivateRollupReceipt {
  format: "private-rollup-receipt";
  formatVersion: 1;
  batchId: string;
  retentionDays: RetentionCohort;
  createdAt?: string;
  storage: {
    driver: "shelby";
    network: "shelbynet";
    verified: true;
    ownerAddress: string;
    blobId: string;
    blobName: string;
    blobSizeBytes: number;
    ciphertextSha256: string;
    packRange?: {
      byteStart: number;
      byteLength: number;
      ciphertextSha256: string;
    };
    transactionHash?: string;
    expiresAt: string;
    downloadUrl: string;
  };
  items: Array<{
    id: string;
    localId: string;
    label: string;
    category: FileCategory;
    mimeType?: string;
    ciphertextSizeBytes: number;
    ciphertextSha256: string;
    encryptedManifest: string;
    wrappedDek: string;
  }>;
}
