import type { RetentionCohort } from "@/domain/files";
import { DomainError } from "@/domain/errors";
import {
  allocatePackCostByBytes,
  estimateReserveMicrocredits,
} from "@/domain/credits";

export type CreditLedgerEntryType =
  | "testnet_grant"
  | "upload_reserve"
  | "upload_release"
  | "pack_settlement";

export type CreditStatus = "reserved" | "settled" | "payment_required";

export interface CreditLedgerEntry {
  id: string;
  type: CreditLedgerEntryType;
  amountMicrocredits: number;
  reservedDeltaMicrocredits: number;
  uploadId?: string;
  packId?: string;
  createdAt: string;
}

export interface CreditAccount {
  userId: string;
  balanceMicrocredits: number;
  reservedMicrocredits: number;
  availableMicrocredits: number;
  ledger: CreditLedgerEntry[];
}

export interface UploadBillingRecord {
  uploadId: string;
  reserveMicrocredits: number;
  settledMicrocredits?: number;
  creditStatus: CreditStatus;
}

export interface PackSettlementAllocation {
  userId: string;
  uploadId: string;
  ciphertextBytes: number;
  costMicrocredits: number;
  status: CreditStatus;
}

export const TESTNET_GRANT_MICROCREDITS = 100_000_000;

const accountsByUserId = new Map<string, CreditAccount>();
const billingByUploadId = new Map<string, UploadBillingRecord>();

export function getCreditAccount(userId: string): CreditAccount {
  const normalizedUserId = requireUserId(userId);
  const existing = accountsByUserId.get(normalizedUserId);
  if (existing) {
    return cloneAccount(existing);
  }

  const account: CreditAccount = {
    userId: normalizedUserId,
    balanceMicrocredits: TESTNET_GRANT_MICROCREDITS,
    reservedMicrocredits: 0,
    availableMicrocredits: TESTNET_GRANT_MICROCREDITS,
    ledger: [
      {
        id: crypto.randomUUID(),
        type: "testnet_grant",
        amountMicrocredits: TESTNET_GRANT_MICROCREDITS,
        reservedDeltaMicrocredits: 0,
        createdAt: new Date().toISOString(),
      },
    ],
  };
  accountsByUserId.set(normalizedUserId, account);
  return cloneAccount(account);
}

export function reserveUploadCredit(input: {
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
  const reserveMicrocredits = estimateReserveMicrocredits({
    ciphertextBytes: input.ciphertextBytes,
    retentionDays: input.retentionDays,
  });

  if (account.availableMicrocredits < reserveMicrocredits) {
    throw new DomainError("Insufficient credit for upload reserve", "CREDIT_INSUFFICIENT");
  }

  account.reservedMicrocredits += reserveMicrocredits;
  account.availableMicrocredits = account.balanceMicrocredits - account.reservedMicrocredits;
  account.ledger.unshift({
    id: crypto.randomUUID(),
    type: "upload_reserve",
    amountMicrocredits: 0,
    reservedDeltaMicrocredits: reserveMicrocredits,
    uploadId,
    createdAt: new Date().toISOString(),
  });

  const billing: UploadBillingRecord = {
    uploadId,
    reserveMicrocredits,
    creditStatus: "reserved",
  };
  billingByUploadId.set(uploadId, billing);
  return { ...billing };
}

export function getUploadBilling(uploadId: string) {
  const billing = billingByUploadId.get(uploadId);
  return billing ? { ...billing } : undefined;
}

export function releaseUploadCredit(userId: string, uploadId: string) {
  const account = requireMutableAccount(requireUserId(userId));
  const billing = billingByUploadId.get(requireUploadId(uploadId));
  if (!billing || billing.creditStatus !== "reserved") return;

  account.reservedMicrocredits = Math.max(
    0,
    account.reservedMicrocredits - billing.reserveMicrocredits,
  );
  account.availableMicrocredits =
    account.balanceMicrocredits - account.reservedMicrocredits;
  account.ledger.unshift({
    id: crypto.randomUUID(),
    type: "upload_release",
    amountMicrocredits: 0,
    reservedDeltaMicrocredits: -billing.reserveMicrocredits,
    uploadId,
    createdAt: new Date().toISOString(),
  });
  billingByUploadId.delete(uploadId);
}

export function settlePackCostByBytes(input: {
  packId: string;
  totalCostMicrocredits: number;
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

  const allocationsByMember = allocatePackCostByBytes({
    totalCostMicrocredits: input.totalCostMicrocredits,
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
      const reserveMicrocredits = billing?.reserveMicrocredits ?? 0;
      const overageMicrocredits = Math.max(
        0,
        allocation.costMicrocredits - reserveMicrocredits,
      );
      const status: CreditStatus =
        account.availableMicrocredits >= overageMicrocredits
          ? "settled"
          : "payment_required";

      if (status === "settled") {
        account.balanceMicrocredits -= allocation.costMicrocredits;
        account.reservedMicrocredits = Math.max(
          0,
          account.reservedMicrocredits - reserveMicrocredits,
        );
        account.availableMicrocredits =
          account.balanceMicrocredits - account.reservedMicrocredits;
        account.ledger.unshift({
          id: crypto.randomUUID(),
          type: "pack_settlement",
          amountMicrocredits: -allocation.costMicrocredits,
          reservedDeltaMicrocredits: -reserveMicrocredits,
          uploadId: member.uploadId,
          packId,
          createdAt: new Date().toISOString(),
        });
      }

      const nextBilling: UploadBillingRecord = {
        uploadId: member.uploadId,
        reserveMicrocredits,
        settledMicrocredits:
          status === "settled" ? allocation.costMicrocredits : undefined,
        creditStatus: status,
      };
      billingByUploadId.set(member.uploadId, nextBilling);

      return {
        userId: member.userId,
        uploadId: member.uploadId,
        ciphertextBytes: member.ciphertextBytes,
        costMicrocredits: allocation.costMicrocredits,
        status,
      };
    },
  );

  return { packId, allocations };
}

export function resetCreditStoreForTests() {
  accountsByUserId.clear();
  billingByUploadId.clear();
}

function requireMutableAccount(userId: string) {
  getCreditAccount(userId);
  const account = accountsByUserId.get(userId);
  if (!account) {
    throw new DomainError("Credit account not found", "CREDIT_ACCOUNT_NOT_FOUND");
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

function cloneAccount(account: CreditAccount): CreditAccount {
  return {
    ...account,
    ledger: account.ledger.map((entry) => ({ ...entry })),
  };
}
