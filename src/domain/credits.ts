import type { RetentionCohort } from "./files";
import { parseRetentionCohort } from "./files";
import { DomainError } from "./errors";

export const MICROCREDITS_PER_CREDIT = 1_000_000;
const BASE_MICROCREDITS_PER_KIB_30_DAYS = 500;

export interface EstimateReserveInput {
  ciphertextBytes: number;
  retentionDays: RetentionCohort;
}

export interface AllocatePackCostInput {
  totalCostMicrocredits: number;
  members: Array<{
    memberId: string;
    ciphertextBytes: number;
  }>;
}

export interface PackCostAllocation {
  memberId: string;
  costMicrocredits: number;
}

export function estimateReserveMicrocredits(input: EstimateReserveInput) {
  assertSafeNonNegativeInteger(input.ciphertextBytes, "Ciphertext bytes");
  const retentionDays = parseRetentionCohort(input.retentionDays);
  const kib = Math.max(1, Math.ceil(input.ciphertextBytes / 1024));
  return Math.ceil(
    kib * BASE_MICROCREDITS_PER_KIB_30_DAYS * (retentionDays / 30),
  );
}

export function allocatePackCostByBytes(
  input: AllocatePackCostInput,
): PackCostAllocation[] {
  assertSafeNonNegativeInteger(input.totalCostMicrocredits, "Pack cost");

  if (!Array.isArray(input.members) || input.members.length === 0) {
    throw new DomainError("Pack members are required", "PACK_MEMBERS_REQUIRED");
  }

  const totalBytes = input.members.reduce((total, member) => {
    assertSafeNonNegativeInteger(member.ciphertextBytes, "Member ciphertext bytes");
    if (!member.memberId.trim()) {
      throw new DomainError("Pack member ID is required", "PACK_MEMBER_ID_REQUIRED");
    }
    return total + member.ciphertextBytes;
  }, 0);

  if (totalBytes <= 0) {
    throw new DomainError(
      "Pack ciphertext bytes must be greater than zero",
      "PACK_BYTES_REQUIRED",
    );
  }

  const totalCost = BigInt(input.totalCostMicrocredits);
  const totalBytesBigInt = BigInt(totalBytes);
  const allocations = input.members.map((member, index) => {
    const exactNumerator = totalCost * BigInt(member.ciphertextBytes);
    const baseCost = Number(exactNumerator / totalBytesBigInt);
    const remainder = Number(exactNumerator % totalBytesBigInt);

    return {
      index,
      memberId: member.memberId,
      ciphertextBytes: member.ciphertextBytes,
      costMicrocredits: baseCost,
      remainder,
    };
  });

  let remainderToDistribute =
    input.totalCostMicrocredits -
    allocations.reduce((total, allocation) => total + allocation.costMicrocredits, 0);

  for (const allocation of [...allocations].sort(compareRemainders)) {
    if (remainderToDistribute <= 0) {
      break;
    }
    allocation.costMicrocredits += 1;
    remainderToDistribute -= 1;
  }

  return allocations
    .sort((left, right) => left.index - right.index)
    .map(({ costMicrocredits, memberId }) => ({ memberId, costMicrocredits }));
}

export function formatCredits(microcredits: number) {
  assertSafeNonNegativeInteger(Math.abs(microcredits), "Credit amount");
  const sign = microcredits < 0 ? "-" : "";
  const absolute = Math.abs(microcredits);
  const credits = Math.floor(absolute / MICROCREDITS_PER_CREDIT);
  const fractional = String(absolute % MICROCREDITS_PER_CREDIT).padStart(6, "0");
  return `${sign}${credits}.${fractional} credits`;
}

function compareRemainders(
  left: { remainder: number; ciphertextBytes: number; index: number },
  right: { remainder: number; ciphertextBytes: number; index: number },
) {
  if (right.remainder !== left.remainder) {
    return right.remainder - left.remainder;
  }
  if (right.ciphertextBytes !== left.ciphertextBytes) {
    return right.ciphertextBytes - left.ciphertextBytes;
  }
  return left.index - right.index;
}

function assertSafeNonNegativeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainError(
      `${label} must be a non-negative integer`,
      "CREDIT_AMOUNT_INVALID",
    );
  }
}
