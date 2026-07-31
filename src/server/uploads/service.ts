import { randomUUID } from "node:crypto";
import type { FileCategory, PackStrategy, RetentionCohort } from "@/domain/files";
import {
  MAX_BATCH_FILES,
  MAX_FILE_SIZE_BYTES,
  parseRetentionCohort,
  selectPackStrategy,
} from "@/domain/files";
import type { UploadStatus } from "@/domain/uploads";
import { DomainError } from "@/domain/errors";

export interface CreateUploadItemInput {
  localId: string;
  label: string;
  category: FileCategory;
  mimeType?: string;
  plaintextSizeBytes: number;
  ciphertextSizeBytes: number;
  ciphertextSha256: string;
  encryptedManifest: string;
  wrappedDek: string;
}

export interface CreateUploadBatchInput {
  userId: string;
  idempotencyKey: string;
  retentionDays: RetentionCohort;
  items: CreateUploadItemInput[];
}

export interface CompleteUploadItemInput {
  localId: string;
  ciphertextSha256: string;
  stagingRef: string;
}

export interface CompleteUploadBatchInput {
  userId: string;
  batchId: string;
  items: CompleteUploadItemInput[];
}

export interface UploadItemRecord extends CreateUploadItemInput {
  id: string;
  batchId: string;
  status: UploadStatus;
  packStrategy: PackStrategy;
  stagingRef?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadBatchRecord {
  id: string;
  userId: string;
  idempotencyKey: string;
  retentionDays: RetentionCohort;
  status: UploadStatus;
  totalCiphertextSizeBytes: number;
  items: UploadItemRecord[];
  createdAt: string;
  updatedAt: string;
}

const batchesById = new Map<string, UploadBatchRecord>();
const idempotencyIndex = new Map<string, string>();

export function createUploadBatch(input: CreateUploadBatchInput): UploadBatchRecord {
  const retentionDays = parseRetentionCohort(input.retentionDays);
  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey) {
    throw new DomainError("Idempotency key is required", "UPLOAD_IDEMPOTENCY_REQUIRED");
  }

  const existingId = idempotencyIndex.get(makeIdempotencyIndexKey(input.userId, idempotencyKey));
  if (existingId) {
    return cloneBatch(requireBatch(existingId, input.userId));
  }

  assertValidItems(input.items);

  const now = new Date().toISOString();
  const batchId = randomUUID();
  const items = input.items.map((item) => createItemRecord(batchId, item, now));
  const batch: UploadBatchRecord = {
    id: batchId,
    userId: input.userId,
    idempotencyKey,
    retentionDays,
    status: "staging",
    totalCiphertextSizeBytes: items.reduce(
      (total, item) => total + item.ciphertextSizeBytes,
      0,
    ),
    items,
    createdAt: now,
    updatedAt: now,
  };

  batchesById.set(batch.id, batch);
  idempotencyIndex.set(makeIdempotencyIndexKey(input.userId, idempotencyKey), batch.id);
  return cloneBatch(batch);
}

export function completeUploadBatch(input: CompleteUploadBatchInput): UploadBatchRecord {
  const batch = requireBatch(input.batchId, input.userId);
  if (batch.status === "waiting_for_pack") {
    return cloneBatch(batch);
  }

  const completionsByLocalId = new Map(
    input.items.map((item) => [item.localId, item] as const),
  );

  if (completionsByLocalId.size !== batch.items.length) {
    markBatchFailed(batch);
    throw new DomainError("Completion item count does not match batch", "UPLOAD_COMPLETE_MISMATCH");
  }

  for (const item of batch.items) {
    const completion = completionsByLocalId.get(item.localId);
    if (!completion) {
      markBatchFailed(batch);
      throw new DomainError("Missing completion item", "UPLOAD_COMPLETE_MISMATCH");
    }

    if (completion.ciphertextSha256 !== item.ciphertextSha256) {
      markBatchFailed(batch);
      throw new DomainError("Ciphertext checksum mismatch", "UPLOAD_CHECKSUM_MISMATCH");
    }

    if (!completion.stagingRef.trim()) {
      markBatchFailed(batch);
      throw new DomainError("Staging reference is required", "UPLOAD_STAGING_REF_REQUIRED");
    }
  }

  const now = new Date().toISOString();
  for (const item of batch.items) {
    const completion = completionsByLocalId.get(item.localId);
    item.status = "waiting_for_pack";
    item.stagingRef = completion?.stagingRef;
    item.updatedAt = now;
  }

  batch.status = "waiting_for_pack";
  batch.updatedAt = now;
  return cloneBatch(batch);
}

export function getUploadBatch(
  batchId: string,
  userId: string,
): UploadBatchRecord | undefined {
  const batch = batchesById.get(batchId);
  if (!batch || batch.userId !== userId) {
    return undefined;
  }

  return cloneBatch(batch);
}

export function resetUploadStoreForTests() {
  batchesById.clear();
  idempotencyIndex.clear();
}

function createItemRecord(
  batchId: string,
  item: CreateUploadItemInput,
  now: string,
): UploadItemRecord {
  return {
    ...item,
    id: randomUUID(),
    batchId,
    status: "staging",
    packStrategy: selectPackStrategy(item.ciphertextSizeBytes),
    createdAt: now,
    updatedAt: now,
  };
}

function assertValidItems(items: CreateUploadItemInput[]) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new DomainError("Upload batch must contain at least one item", "UPLOAD_ITEMS_REQUIRED");
  }

  if (items.length > MAX_BATCH_FILES) {
    throw new DomainError("Upload batch exceeds file limit", "UPLOAD_ITEMS_LIMIT");
  }

  const localIds = new Set<string>();
  for (const item of items) {
    assertNoPlaintextPayloadFields(item);
    if (!item.localId.trim() || localIds.has(item.localId)) {
      throw new DomainError("Upload items require unique local IDs", "UPLOAD_LOCAL_ID_INVALID");
    }
    localIds.add(item.localId);

    if (!item.label.trim()) {
      throw new DomainError("Upload item label is required", "UPLOAD_LABEL_REQUIRED");
    }

    assertSafeSize(item.plaintextSizeBytes, "Plaintext size");
    assertSafeSize(item.ciphertextSizeBytes, "Ciphertext size");
    if (item.plaintextSizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new DomainError("Plaintext file size exceeds MVP limit", "UPLOAD_FILE_TOO_LARGE");
    }
    if (item.ciphertextSizeBytes < item.plaintextSizeBytes) {
      throw new DomainError("Ciphertext size cannot be smaller than plaintext size", "UPLOAD_SIZE_INVALID");
    }
    if (!/^[a-f0-9]{64}$/i.test(item.ciphertextSha256)) {
      throw new DomainError("Ciphertext checksum must be sha256 hex", "UPLOAD_CHECKSUM_INVALID");
    }
    if (!item.encryptedManifest.trim() || !item.wrappedDek.trim()) {
      throw new DomainError("Encrypted manifest and wrapped DEK are required", "UPLOAD_CRYPTO_MISSING");
    }
  }
}

function assertNoPlaintextPayloadFields(item: CreateUploadItemInput) {
  const rawItem = item as unknown as Record<string, unknown>;
  const forbiddenFields = [
    "plaintext",
    "plaintextBytes",
    "fileBytes",
    "content",
    "rawFile",
  ];

  if (forbiddenFields.some((field) => field in rawItem)) {
    throw new DomainError("Plaintext payload fields are not accepted", "UPLOAD_PLAINTEXT_REJECTED");
  }
}

function assertSafeSize(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainError(`${label} must be a non-negative integer`, "UPLOAD_SIZE_INVALID");
  }
}

function requireBatch(batchId: string, userId: string) {
  const batch = batchesById.get(batchId);
  if (!batch || batch.userId !== userId) {
    throw new DomainError("Upload batch not found", "UPLOAD_NOT_FOUND");
  }

  return batch;
}

function markBatchFailed(batch: UploadBatchRecord) {
  const now = new Date().toISOString();
  batch.status = "failed";
  batch.updatedAt = now;
  for (const item of batch.items) {
    item.status = "failed";
    item.updatedAt = now;
  }
}

function makeIdempotencyIndexKey(userId: string, idempotencyKey: string) {
  return `${userId}:${idempotencyKey}`;
}

function cloneBatch(batch: UploadBatchRecord): UploadBatchRecord {
  return {
    ...batch,
    items: batch.items.map((item) => ({ ...item })),
  };
}
