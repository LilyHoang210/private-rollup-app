import type { RetentionCohort } from "./files";
import { parseRetentionCohort } from "./files";
import { DomainError } from "./errors";

export const OCTAS_PER_APT = 100_000_000;
const BASE_OCTAS_PER_KIB_30_DAYS = 500;

export interface EstimateReserveInput {
  ciphertextBytes: number;
  retentionDays: RetentionCohort;
}

export interface AllocatePackCostInput {
  totalCostOctas: number;
  members: Array<{ memberId: string; ciphertextBytes: number }>;
}

export interface PackCostAllocation {
  memberId: string;
  costOctas: number;
}

export function estimateReserveOctas(input: EstimateReserveInput) {
  assertSafeNonNegativeInteger(input.ciphertextBytes, "Ciphertext bytes");
  const retentionDays = parseRetentionCohort(input.retentionDays);
  const kib = Math.max(1, Math.ceil(input.ciphertextBytes / 1024));
  return Math.ceil(kib * BASE_OCTAS_PER_KIB_30_DAYS * (retentionDays / 30));
}

export function allocatePackCostOctasByBytes(
  input: AllocatePackCostInput,
): PackCostAllocation[] {
  assertSafeNonNegativeInteger(input.totalCostOctas, "Pack cost");
  if (input.members.length === 0) {
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

  const totalCost = BigInt(input.totalCostOctas);
  const totalBytesBigInt = BigInt(totalBytes);
  const allocations = input.members.map((member, index) => {
    const numerator = totalCost * BigInt(member.ciphertextBytes);
    return {
      index,
      memberId: member.memberId,
      ciphertextBytes: member.ciphertextBytes,
      costOctas: Number(numerator / totalBytesBigInt),
      remainder: Number(numerator % totalBytesBigInt),
    };
  });

  let remainder =
    input.totalCostOctas -
    allocations.reduce((total, allocation) => total + allocation.costOctas, 0);
  for (const allocation of [...allocations].sort(compareRemainders)) {
    if (remainder <= 0) break;
    allocation.costOctas += 1;
    remainder -= 1;
  }

  return allocations
    .sort((left, right) => left.index - right.index)
    .map(({ costOctas, memberId }) => ({ memberId, costOctas }));
}

export function formatApt(octas: number) {
  assertSafeNonNegativeInteger(Math.abs(octas), "APT amount");
  const sign = octas < 0 ? "-" : "";
  const absolute = Math.abs(octas);
  const whole = Math.floor(absolute / OCTAS_PER_APT);
  const fractional = String(absolute % OCTAS_PER_APT)
    .padStart(8, "0")
    .replace(/0+$/, "");
  return `${sign}${whole}${fractional ? `.${fractional}` : ""} APT`;
}

export function parseAptToOctas(value: string) {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(normalized)) {
    throw new DomainError(
      "APT amount must use at most 8 decimal places",
      "APT_AMOUNT_INVALID",
    );
  }
  const [whole, fractional = ""] = normalized.split(".");
  const octas = Number(
    BigInt(whole) * BigInt(OCTAS_PER_APT) +
      BigInt(fractional.padEnd(8, "0")),
  );
  assertSafeNonNegativeInteger(octas, "APT amount");
  return octas;
}

function compareRemainders(
  left: { remainder: number; ciphertextBytes: number; index: number },
  right: { remainder: number; ciphertextBytes: number; index: number },
) {
  if (right.remainder !== left.remainder) return right.remainder - left.remainder;
  if (right.ciphertextBytes !== left.ciphertextBytes) {
    return right.ciphertextBytes - left.ciphertextBytes;
  }
  return left.index - right.index;
}

function assertSafeNonNegativeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainError(
      `${label} must be a non-negative integer`,
      "APT_AMOUNT_INVALID",
    );
  }
}
