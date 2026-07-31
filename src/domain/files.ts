import { z } from "zod";
import { DomainError } from "./errors";

export const PACK_STRATEGY_THRESHOLD_BYTES = 10 * 1024 * 1024;
export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_BATCH_FILES = 1000;

export const retentionCohortSchema = z.union([
  z.literal(30),
  z.literal(90),
  z.literal(365),
]);

export type RetentionCohort = z.infer<typeof retentionCohortSchema>;

export type PackStrategy = "shared_pack" | "dedicated_blob";

export type FileCategory =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "dataset"
  | "archive"
  | "code"
  | "other";

export function parseRetentionCohort(value: unknown): RetentionCohort {
  const parsed = retentionCohortSchema.safeParse(value);

  if (!parsed.success) {
    throw new DomainError("Unsupported retention cohort", "RETENTION_UNSUPPORTED");
  }

  return parsed.data;
}

export function selectPackStrategy(sizeBytes: number): PackStrategy {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
    throw new DomainError("File size must be a non-negative integer", "FILE_SIZE_INVALID");
  }

  return sizeBytes < PACK_STRATEGY_THRESHOLD_BYTES
    ? "shared_pack"
    : "dedicated_blob";
}
