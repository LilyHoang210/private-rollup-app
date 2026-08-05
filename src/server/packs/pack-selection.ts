import type { RetentionCohort } from "@/domain/files";

export const TARGET_SHARED_PACK_BYTES = 8 * 1024 * 1024;
export const MAX_SHARED_PACK_BYTES = 50 * 1024 * 1024;
export const MAX_WAIT_MS = 5 * 60 * 1000;

export interface PackCandidate {
  id: string;
  retentionDays: RetentionCohort;
  packBytes: number;
  createdAt: Date;
  dedicated: boolean;
}

export function selectPackCandidates(input: {
  now: Date;
  candidates: PackCandidate[];
  forceBatchId?: string;
}) {
  const valid = input.candidates.filter(
    (candidate) =>
      candidate.id &&
      Number.isSafeInteger(candidate.packBytes) &&
      candidate.packBytes > 0,
  );
  const forced = input.forceBatchId
    ? valid.find((candidate) => candidate.id === input.forceBatchId)
    : undefined;

  if (input.forceBatchId && !forced) return [];
  if (forced?.dedicated) return [forced];

  const anchor = forced ?? findAutomaticAnchor(valid, input.now);
  if (!anchor) return [];
  if (anchor.dedicated) return [anchor];

  const cohort = valid.filter(
    (candidate) =>
      !candidate.dedicated && candidate.retentionDays === anchor.retentionDays,
  );
  const selected: PackCandidate[] = [];
  let total = 0;
  for (const candidate of cohort) {
    if (selected.length > 0 && total + candidate.packBytes > MAX_SHARED_PACK_BYTES) {
      break;
    }
    selected.push(candidate);
    total += candidate.packBytes;
  }
  return selected;
}

function findAutomaticAnchor(candidates: PackCandidate[], now: Date) {
  const dedicated = candidates.find((candidate) => candidate.dedicated);
  if (dedicated) return dedicated;

  const seenCohorts = new Set<number>();
  for (const candidate of candidates) {
    if (seenCohorts.has(candidate.retentionDays)) continue;
    seenCohorts.add(candidate.retentionDays);
    const cohort = candidates.filter(
      (item) =>
        !item.dedicated && item.retentionDays === candidate.retentionDays,
    );
    const totalBytes = cohort.reduce((total, item) => total + item.packBytes, 0);
    const waitedLongEnough =
      now.getTime() - candidate.createdAt.getTime() >= MAX_WAIT_MS;
    if (totalBytes >= TARGET_SHARED_PACK_BYTES || waitedLongEnough) {
      return candidate;
    }
  }
  return undefined;
}
