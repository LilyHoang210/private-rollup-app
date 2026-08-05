import { Aptos, AptosConfig } from "@aptos-labs/ts-sdk";
import { SHELBY_APTOS_NETWORK } from "@/config/shelbynet";
import { DomainError } from "@/domain/errors";
import { quoteVaultUpload } from "@/server/vault/payment-vault-quote";

interface VaultReservationInput {
  userId: string;
  userAddress: `0x${string}`;
  vaultRequestId: string;
  reservationTransactionHash: string;
  reservationDeadlineSecs: number;
  expectedEncryptedBytes: number;
  expectedRetentionDays: "30" | "90" | "365";
  contractAddress?: `0x${string}`;
}

interface TransactionVerifierClient {
  getTransactionByHash(input: { transactionHash: string }): Promise<unknown>;
}

const aptos = new Aptos(new AptosConfig({ network: SHELBY_APTOS_NETWORK }));

export function assertVaultReservationReady(input: VaultReservationInput) {
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

export async function verifyVaultReservationTransaction(
  input: VaultReservationInput & { contractAddress: `0x${string}` },
  dependencies: { aptosClient?: TransactionVerifierClient } = {},
) {
  assertVaultReservationReady(input);
  const tx = await (dependencies.aptosClient ?? aptos).getTransactionByHash({
    transactionHash: input.reservationTransactionHash,
  });
  const transaction = parseUserTransaction(tx);
  if (!transaction.success) {
    throw new DomainError(
      "Payment Vault reservation transaction did not succeed",
      "VAULT_RESERVATION_TX_FAILED",
    );
  }
  if (normalizeAddress(transaction.sender) !== normalizeAddress(input.userAddress)) {
    throw new DomainError(
      "Payment Vault reservation sender does not match the connected wallet",
      "VAULT_RESERVATION_SENDER_MISMATCH",
    );
  }

  if (
    !isExpectedMoveFunction(
      transaction.payload.function,
      input.contractAddress,
      "payment_vault",
      "upload_with_payment",
    )
  ) {
    throw new DomainError(
      "Payment Vault reservation transaction does not call upload_with_payment",
      "VAULT_RESERVATION_FUNCTION_MISMATCH",
    );
  }

  const args = transaction.payload.arguments;
  if (args.length < 3) {
    throw new DomainError(
      "Payment Vault reservation transaction arguments are incomplete",
      "VAULT_RESERVATION_TX_INVALID",
    );
  }
  if (decodeMoveBytesArgument(args[0]) !== input.vaultRequestId) {
    throw new DomainError(
      "Payment Vault reservation request ID does not match upload metadata",
      "VAULT_RESERVATION_REQUEST_MISMATCH",
    );
  }
  if (toNumberArgument(args[1]) !== input.expectedEncryptedBytes) {
    throw new DomainError(
      "Payment Vault reservation encrypted size does not match upload metadata",
      "VAULT_RESERVATION_SIZE_MISMATCH",
    );
  }
  if (String(toNumberArgument(args[2])) !== input.expectedRetentionDays) {
    throw new DomainError(
      "Payment Vault reservation retention does not match upload metadata",
      "VAULT_RESERVATION_RETENTION_MISMATCH",
    );
  }
}

function parseUserTransaction(value: unknown) {
  if (!isRecord(value)) {
    throw new DomainError(
      "Payment Vault reservation transaction is unavailable",
      "VAULT_RESERVATION_TX_UNAVAILABLE",
    );
  }
  if (value.type !== "user_transaction") {
    throw new DomainError(
      "Payment Vault reservation hash is not a user transaction",
      "VAULT_RESERVATION_TX_INVALID",
    );
  }
  const payload = isRecord(value.payload) ? value.payload : undefined;
  if (
    typeof value.sender !== "string" ||
    typeof value.success !== "boolean" ||
    !payload ||
    typeof payload.function !== "string" ||
    !Array.isArray(payload.arguments)
  ) {
    throw new DomainError(
      "Payment Vault reservation transaction payload is invalid",
      "VAULT_RESERVATION_TX_INVALID",
    );
  }
  return {
    sender: value.sender,
    success: value.success,
    payload: {
      function: payload.function,
      arguments: payload.arguments,
    },
  };
}

function decodeMoveBytesArgument(value: unknown) {
  if (typeof value === "string") {
    const clean = value.startsWith("0x") ? value.slice(2) : value;
    if (/^[a-fA-F0-9]*$/.test(clean) && clean.length % 2 === 0) {
      return new TextDecoder().decode(
        Uint8Array.from(
          clean.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [],
        ),
      );
    }
    return value;
  }
  if (Array.isArray(value) && value.every((item) => Number.isInteger(item))) {
    return new TextDecoder().decode(Uint8Array.from(value as number[]));
  }
  if (value instanceof Uint8Array) {
    return new TextDecoder().decode(value);
  }
  return "";
}

function toNumberArgument(value: unknown) {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(numberValue)) {
    throw new DomainError(
      "Payment Vault reservation transaction argument is invalid",
      "VAULT_RESERVATION_TX_INVALID",
    );
  }
  return numberValue;
}

function normalizeAddress(value: string) {
  return value.trim().toLowerCase().replace(/^0x0*/, "0x");
}

function isExpectedMoveFunction(
  value: string,
  expectedAddress: `0x${string}`,
  expectedModule: string,
  expectedFunction: string,
) {
  const [address, moduleName, functionName] = value.split("::");
  return (
    Boolean(address) &&
    normalizeAddress(address) === normalizeAddress(expectedAddress) &&
    moduleName === expectedModule &&
    functionName === expectedFunction
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
