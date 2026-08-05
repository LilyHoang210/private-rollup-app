export type VaultUploadMode = "shared_pack" | "dedicated_blob";

export type VaultUploadStatus =
  | "reserved"
  | "registering"
  | "uploading"
  | "settled"
  | "failed"
  | "refunded"
  | "expired";

export interface VaultUploadQuoteInput {
  encryptedSizeBytes: number;
  retentionDays: "30" | "90" | "365";
  mode: VaultUploadMode;
}

export interface VaultUploadQuote {
  encryptedSizeBytes: number;
  retentionDays: "30" | "90" | "365";
  mode: VaultUploadMode;
  estimatedShelbyFeeOctas: number;
  estimatedStorageFeeOctas: number;
  platformFeeOctas: number;
  safetyBufferOctas: number;
  totalLockedOctas: number;
  refundPolicy: "full_refund_before_success_settlement";
}

export interface VaultUploadReservation {
  requestId: string;
  userAddress: `0x${string}`;
  quote: VaultUploadQuote;
  status: VaultUploadStatus;
  transactionHash?: string;
  refundableOctas: number;
  settledOctas: number;
  ownerFeeReleasedOctas: number;
  createdAt: string;
  deadlineAt: string;
}
