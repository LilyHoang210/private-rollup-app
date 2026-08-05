import type { RetentionCohort } from "@/domain/files";
import {
  MAX_SHARED_PACK_BYTES,
  MAX_WAIT_MS,
  TARGET_SHARED_PACK_BYTES,
} from "@/server/packs/pack-selection";

const RETENTION_COHORTS: RetentionCohort[] = [30, 90, 365];

export type PackPoolTrigger = "byte_threshold" | "wait_time" | "waiting";

export interface PackPoolBatch {
  id: string;
  retentionDays: RetentionCohort;
  status: string;
  totalCiphertextSizeBytes: number;
  createdAt?: string;
  items: Array<{ packStrategy: "shared_pack" | "dedicated_blob" | string }>;
}

export interface PackPoolSummary {
  retentionDays: RetentionCohort;
  queuedBytes: number;
  targetBytes: number;
  maxBytes: number;
  maxWaitSeconds: number;
  waitingBatchCount: number;
  progressRatio: number;
  oldestQueuedAt?: string;
  closesAt?: string;
  secondsRemaining?: number;
  trigger: PackPoolTrigger;
  nextTrigger: Exclude<PackPoolTrigger, "waiting">;
  oldestBatchId?: string;
  userBatchIds: string[];
}

export function summarizePackPools(input: {
  now: Date;
  batches: PackPoolBatch[];
}): PackPoolSummary[] {
  return RETENTION_COHORTS.map((retentionDays) =>
    summarizeCohort({
      now: input.now,
      retentionDays,
      batches: input.batches.filter(
        (batch) =>
          batch.status === "waiting_for_pack" &&
          batch.retentionDays === retentionDays &&
          batch.items.every((item) => item.packStrategy !== "dedicated_blob"),
      ),
    }),
  );
}

function summarizeCohort(input: {
  now: Date;
  retentionDays: RetentionCohort;
  batches: PackPoolBatch[];
}): PackPoolSummary {
  const sorted = [...input.batches].sort((left, right) =>
    String(left.createdAt ?? "").localeCompare(String(right.createdAt ?? "")),
  );
  const queuedBytes = sorted.reduce(
    (total, batch) => total + batch.totalCiphertextSizeBytes,
    0,
  );
  const oldest = sorted[0];
  const closesAt = oldest?.createdAt
    ? new Date(new Date(oldest.createdAt).getTime() + MAX_WAIT_MS)
    : undefined;
  const secondsRemaining = closesAt
    ? Math.max(0, Math.ceil((closesAt.getTime() - input.now.getTime()) / 1000))
    : undefined;
  const progressRatio = Math.min(1, queuedBytes / TARGET_SHARED_PACK_BYTES);

  return {
    retentionDays: input.retentionDays,
    queuedBytes,
    targetBytes: TARGET_SHARED_PACK_BYTES,
    maxBytes: MAX_SHARED_PACK_BYTES,
    maxWaitSeconds: MAX_WAIT_MS / 1000,
    waitingBatchCount: sorted.length,
    progressRatio,
    oldestQueuedAt: oldest?.createdAt,
    closesAt: closesAt?.toISOString(),
    secondsRemaining,
    trigger:
      queuedBytes >= TARGET_SHARED_PACK_BYTES
        ? "byte_threshold"
        : secondsRemaining === 0
          ? "wait_time"
          : "waiting",
    nextTrigger:
      queuedBytes >= TARGET_SHARED_PACK_BYTES
        ? "byte_threshold"
        : "wait_time",
    oldestBatchId: oldest?.id,
    userBatchIds: sorted.map((batch) => batch.id),
  };
}
