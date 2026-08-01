import type { UploadApiBatchResponse } from "@/client/api/uploads";

export const LOCAL_UPLOAD_BATCHES_KEY = "private-rollup:upload-batches:v1";
const MAX_LOCAL_BATCHES = 25;

export function readLocalUploadBatches(
  storage: Storage | undefined = getBrowserStorage(),
): UploadApiBatchResponse[] {
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(LOCAL_UPLOAD_BATCHES_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isUploadBatchLike);
  } catch {
    return [];
  }
}

export function rememberLocalUploadBatch(
  batch: UploadApiBatchResponse,
  storage: Storage | undefined = getBrowserStorage(),
) {
  if (!storage || !isUploadBatchLike(batch)) {
    return;
  }

  const next = mergeUploadBatches([batch], readLocalUploadBatches(storage)).slice(
    0,
    MAX_LOCAL_BATCHES,
  );
  storage.setItem(LOCAL_UPLOAD_BATCHES_KEY, JSON.stringify(next));
}

export function mergeUploadBatches(
  apiBatches: UploadApiBatchResponse[],
  localBatches: UploadApiBatchResponse[],
): UploadApiBatchResponse[] {
  const seen = new Set<string>();
  const merged: UploadApiBatchResponse[] = [];

  for (const batch of [...apiBatches, ...localBatches]) {
    if (!batch.id || seen.has(batch.id)) {
      continue;
    }
    seen.add(batch.id);
    merged.push(batch);
  }

  return merged.sort((left, right) =>
    String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? "")),
  );
}

function getBrowserStorage() {
  if (typeof globalThis === "undefined" || !("localStorage" in globalThis)) {
    return undefined;
  }

  return globalThis.localStorage;
}

function isUploadBatchLike(value: unknown): value is UploadApiBatchResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const batch = value as Partial<UploadApiBatchResponse>;
  return (
    typeof batch.id === "string" &&
    typeof batch.status === "string" &&
    typeof batch.totalCiphertextSizeBytes === "number" &&
    Array.isArray(batch.items)
  );
}
