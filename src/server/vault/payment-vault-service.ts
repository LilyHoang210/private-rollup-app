import { DomainError } from "@/domain/errors";
import { quoteVaultUpload } from "@/server/vault/payment-vault-quote";

export function assertVaultReservationReady(input: {
  userId: string;
  userAddress: `0x${string}`;
  vaultRequestId: string;
  reservationTransactionHash: string;
  reservationDeadlineSecs: number;
  expectedEncryptedBytes: number;
  expectedRetentionDays: "30" | "90" | "365";
}) {
  if (!input.userId.trim()) {
    throw new DomainError("User ID is required", "USER_ID_REQUIRED");
  }
  if (!/^0x[a-fA-F0-9]+$/.test(input.userAddress)) {
    throw new DomainError("User wallet address is invalid", "VAULT_USER_INVALID");
  }
  if (!input.vaultRequestId.trim()) {
    throw new DomainError(
      "Payment Vault reservation is required before upload",
      "VAULT_RESERVATION_REQUIRED",
    );
  }
  if (!/^0x[a-fA-F0-9]+$/.test(input.reservationTransactionHash)) {
    throw new DomainError(
      "Payment Vault reservation transaction is invalid",
      "VAULT_RESERVATION_TX_INVALID",
    );
  }
  if (
    !Number.isSafeInteger(input.reservationDeadlineSecs) ||
    input.reservationDeadlineSecs <= 0
  ) {
    throw new DomainError(
      "Payment Vault reservation deadline is invalid",
      "VAULT_RESERVATION_DEADLINE_INVALID",
    );
  }

  quoteVaultUpload({
    encryptedSizeBytes: input.expectedEncryptedBytes,
    retentionDays: input.expectedRetentionDays,
    mode:
      input.expectedEncryptedBytes < 10 * 1024 * 1024
        ? "shared_pack"
        : "dedicated_blob",
  });
}
