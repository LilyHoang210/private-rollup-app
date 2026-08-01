import type { RetentionCohort } from "@/domain/files";
import { DomainError } from "@/domain/errors";
import {
  allocatePackCostOctasByBytes,
  estimateReserveOctas,
} from "@/domain/apt";

export type AptLedgerEntryType =
  | "wallet_deposit"
  | "upload_reserve"
  | "upload_release"
  | "pack_settlement"
  | "withdrawal";

export type PaymentStatus = "reserved" | "settled" | "payment_required";

export interface AptLedgerEntry {
  id: string;
  type: AptLedgerEntryType;
  amountOctas: number;
  reservedDeltaOctas: number;
  uploadId?: string;
  packId?: string;
  createdAt: string;
}

export interface AptAccount {
  userId: string;
  balanceOctas: number;
  reservedOctas: number;
  availableOctas: number;
  ledger: AptLedgerEntry[];
}

export interface UploadBillingRecord {
  uploadId: string;
  reserveOctas: number;
  settledOctas?: number;
  paymentStatus: PaymentStatus;
}

export interface PackSettlementAllocation {
  userId: string;
  uploadId: string;
  ciphertextBytes: number;
  costOctas: number;
  status: PaymentStatus;
}

const accountsByUserId = new Map<string, AptAccount>();
const billingByUploadId = new Map<string, UploadBillingRecord>();
const depositIds = new Set<string>();

export function getAptAccount(userId: string): AptAccount {
  const normalizedUserId = requireUserId(userId);
  const existing = accountsByUserId.get(normalizedUserId);
  if (existing) {
    return cloneAccount(existing);
  }

  const account: AptAccount = {
    userId: normalizedUserId,
    balanceOctas: 0,
    reservedOctas: 0,
    availableOctas: 0,
    ledger: [],
  };
  accountsByUserId.set(normalizedUserId, account);
  return cloneAccount(account);
}

export function recordWalletDeposit(input: {
  userId: string;
  depositId: string;
  amountOctas: number;
}) {
  const userId = requireUserId(input.userId);
  const depositId = input.depositId.trim();
  if (!depositId || depositIds.has(depositId)) return getAptAccount(userId);
  if (!Number.isSafeInteger(input.amountOctas) || input.amountOctas <= 0) {
    throw new DomainError("Deposit amount is invalid", "DEPOSIT_AMOUNT_INVALID");
  }
  const account = requireMutableAccount(userId);
  account.balanceOctas += input.amountOctas;
  account.availableOctas = account.balanceOctas - account.reservedOctas;
  account.ledger.unshift({
    id: crypto.randomUUID(),
    type: "wallet_deposit",
    amountOctas: input.amountOctas,
    reservedDeltaOctas: 0,
    createdAt: new Date().toISOString(),
  });
  depositIds.add(depositId);
  return cloneAccount(account);
}

export function reserveUploadApt(input: {
  userId: string;
  uploadId: string;
  ciphertextBytes: number;
  retentionDays: RetentionCohort;
}): UploadBillingRecord {
  const userId = requireUserId(input.userId);
  const uploadId = requireUploadId(input.uploadId);
  const existing = billingByUploadId.get(uploadId);
  if (existing) {
    return { ...existing };
  }

  const account = requireMutableAccount(userId);
  const reserveOctas = estimateReserveOctas({
    ciphertextBytes: input.ciphertextBytes,
    retentionDays: input.retentionDays,
  });

  if (account.availableOctas < reserveOctas) {
    throw new DomainError(
      "Insufficient available APT for this upload",
      "APT_INSUFFICIENT",
    );
  }

  account.reservedOctas += reserveOctas;
  account.availableOctas = account.balanceOctas - account.reservedOctas;
  account.ledger.unshift({
    id: crypto.randomUUID(),
    type: "upload_reserve",
    amountOctas: 0,
    reservedDeltaOctas: reserveOctas,
    uploadId,
    createdAt: new Date().toISOString(),
  });

  const billing: UploadBillingRecord = {
    uploadId,
    reserveOctas,
    paymentStatus: "reserved",
  };
  billingByUploadId.set(uploadId, billing);
  return { ...billing };
}

export function getUploadBilling(uploadId: string) {
  const billing = billingByUploadId.get(uploadId);
  return billing ? { ...billing } : undefined;
}

export function releaseUploadApt(userId: string, uploadId: string) {
  const account = requireMutableAccount(requireUserId(userId));
  const billing = billingByUploadId.get(requireUploadId(uploadId));
  if (!billing || billing.paymentStatus !== "reserved") return;

  account.reservedOctas = Math.max(
    0,
    account.reservedOctas - billing.reserveOctas,
  );
  account.availableOctas =
    account.balanceOctas - account.reservedOctas;
  account.ledger.unshift({
    id: crypto.randomUUID(),
    type: "upload_release",
    amountOctas: 0,
    reservedDeltaOctas: -billing.reserveOctas,
    uploadId,
    createdAt: new Date().toISOString(),
  });
  billingByUploadId.delete(uploadId);
}

export function settlePackCostByBytes(input: {
  packId: string;
  totalCostOctas: number;
  members: Array<{
    userId: string;
    uploadId: string;
    ciphertextBytes: number;
  }>;
}): { packId: string; allocations: PackSettlementAllocation[] } {
  const packId = input.packId.trim();
  if (!packId) {
    throw new DomainError("Pack ID is required", "PACK_ID_REQUIRED");
  }

  const allocationsByMember = allocatePackCostOctasByBytes({
    totalCostOctas: input.totalCostOctas,
    members: input.members.map((member) => ({
      memberId: member.uploadId,
      ciphertextBytes: member.ciphertextBytes,
    })),
  });

  const allocations: PackSettlementAllocation[] = allocationsByMember.map(
    (allocation) => {
      const member = input.members.find(
        (candidate) => candidate.uploadId === allocation.memberId,
      );
      if (!member) {
        throw new DomainError("Pack member not found", "PACK_MEMBER_NOT_FOUND");
      }

      const account = requireMutableAccount(member.userId);
      const billing = billingByUploadId.get(member.uploadId);
      const reserveOctas = billing?.reserveOctas ?? 0;
      const overageOctas = Math.max(
        0,
        allocation.costOctas - reserveOctas,
      );
      const status: PaymentStatus =
        account.availableOctas >= overageOctas
          ? "settled"
          : "payment_required";

      if (status === "settled") {
        account.balanceOctas -= allocation.costOctas;
        account.reservedOctas = Math.max(
          0,
          account.reservedOctas - reserveOctas,
        );
        account.availableOctas =
          account.balanceOctas - account.reservedOctas;
        account.ledger.unshift({
          id: crypto.randomUUID(),
          type: "pack_settlement",
          amountOctas: -allocation.costOctas,
          reservedDeltaOctas: -reserveOctas,
          uploadId: member.uploadId,
          packId,
          createdAt: new Date().toISOString(),
        });
      }

      const nextBilling: UploadBillingRecord = {
        uploadId: member.uploadId,
        reserveOctas,
        settledOctas:
          status === "settled" ? allocation.costOctas : undefined,
        paymentStatus: status,
      };
      billingByUploadId.set(member.uploadId, nextBilling);

      return {
        userId: member.userId,
        uploadId: member.uploadId,
        ciphertextBytes: member.ciphertextBytes,
        costOctas: allocation.costOctas,
        status,
      };
    },
  );

  return { packId, allocations };
}

export function resetAptStoreForTests() {
  accountsByUserId.clear();
  billingByUploadId.clear();
  depositIds.clear();
}

export function recordWithdrawal(input: {
  userId: string;
  withdrawalId: string;
  amountOctas: number;
}) {
  const userId = requireUserId(input.userId);
  if (!Number.isSafeInteger(input.amountOctas) || input.amountOctas <= 0) {
    throw new DomainError("Withdrawal amount is invalid", "WITHDRAWAL_AMOUNT_INVALID");
  }
  const account = requireMutableAccount(userId);
  if (account.availableOctas < input.amountOctas) {
    throw new DomainError("Insufficient available APT", "APT_INSUFFICIENT");
  }
  account.balanceOctas -= input.amountOctas;
  account.availableOctas = account.balanceOctas - account.reservedOctas;
  account.ledger.unshift({
    id: input.withdrawalId,
    type: "withdrawal",
    amountOctas: -input.amountOctas,
    reservedDeltaOctas: 0,
    createdAt: new Date().toISOString(),
  });
  return cloneAccount(account);
}

function requireMutableAccount(userId: string) {
  getAptAccount(userId);
  const account = accountsByUserId.get(userId);
  if (!account) {
    throw new DomainError("APT account not found", "APT_ACCOUNT_NOT_FOUND");
  }
  return account;
}

function requireUserId(userId: string) {
  const normalized = userId.trim();
  if (!normalized) {
    throw new DomainError("User ID is required", "USER_ID_REQUIRED");
  }
  return normalized;
}

function requireUploadId(uploadId: string) {
  const normalized = uploadId.trim();
  if (!normalized) {
    throw new DomainError("Upload ID is required", "UPLOAD_ID_REQUIRED");
  }
  return normalized;
}

function cloneAccount(account: AptAccount): AptAccount {
  return {
    ...account,
    ledger: account.ledger.map((entry) => ({ ...entry })),
  };
}
