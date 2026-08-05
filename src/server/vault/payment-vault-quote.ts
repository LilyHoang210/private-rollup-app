import { DomainError } from "@/domain/errors";
import type {
  VaultUploadQuote,
  VaultUploadQuoteInput,
} from "@/server/vault/payment-vault-types";

const BASE_SHELBY_FEE_OCTAS = 4_000;
const STORAGE_OCTAS_PER_MIB_30_DAYS = 65_536;
const PLATFORM_FEE_BPS = 500;
const SAFETY_BUFFER_BPS = 2_000;

const RETENTION_MULTIPLIER: Record<
  VaultUploadQuoteInput["retentionDays"],
  number
> = {
  "30": 1,
  "90": 3,
  "365": 13,
};

export function quoteVaultUpload(
  input: VaultUploadQuoteInput,
): VaultUploadQuote {
  assertPositiveSafeInteger(input.encryptedSizeBytes);

  const mib = input.encryptedSizeBytes / 1_048_576;
  const estimatedStorageFeeOctas = Math.ceil(
    mib *
      STORAGE_OCTAS_PER_MIB_30_DAYS *
      RETENTION_MULTIPLIER[input.retentionDays],
  );
  const estimatedShelbyFeeOctas = BASE_SHELBY_FEE_OCTAS;
  const subtotal = estimatedShelbyFeeOctas + estimatedStorageFeeOctas;
  const platformFeeOctas = Math.ceil((subtotal * PLATFORM_FEE_BPS) / 10_000);
  const safetyBufferOctas = Math.ceil(
    ((subtotal + platformFeeOctas) * SAFETY_BUFFER_BPS) / 10_000,
  );

  return {
    encryptedSizeBytes: input.encryptedSizeBytes,
    retentionDays: input.retentionDays,
    mode: input.mode,
    estimatedShelbyFeeOctas,
    estimatedStorageFeeOctas,
    platformFeeOctas,
    safetyBufferOctas,
    totalLockedOctas:
      estimatedShelbyFeeOctas +
      estimatedStorageFeeOctas +
      platformFeeOctas +
      safetyBufferOctas,
    refundPolicy: "full_refund_before_success_settlement",
  };
}

function assertPositiveSafeInteger(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new DomainError(
      "Encrypted size must be a positive safe integer",
      "VAULT_QUOTE_SIZE_INVALID",
    );
  }
}
