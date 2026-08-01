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

    return parsed.filter(isUploadBatchLike).map(normalizeCachedBatch);
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

  const next = [
    batch,
    ...readLocalUploadBatches(storage).filter((item) => item.id !== batch.id),
  ].slice(0, MAX_LOCAL_BATCHES);
  storage.setItem(LOCAL_UPLOAD_BATCHES_KEY, JSON.stringify(next));
}

export function mergeUploadBatches(
  apiBatches: UploadApiBatchResponse[],
  localBatches: UploadApiBatchResponse[],
): UploadApiBatchResponse[] {
  const localById = new Map(localBatches.map((batch) => [batch.id, batch]));
  const apiIds = new Set(apiBatches.map((batch) => batch.id));
  const merged = apiBatches.map((apiBatch) => {
    const local = localById.get(apiBatch.id);
    if (!local) return apiBatch;
    const localItems = new Map(local.items.map((item) => [item.localId, item]));
    return {
      ...apiBatch,
      items: apiBatch.items.map((item) => {
        const privateItem = localItems.get(item.localId);
        return privateItem
          ? {
              ...item,
              label: privateItem.label,
              category: privateItem.category,
              mimeType: privateItem.mimeType,
            }
          : item;
      }),
    };
  });
  merged.push(...localBatches.filter((batch) => !apiIds.has(batch.id)));

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

function normalizeCachedBatch(batch: UploadApiBatchResponse): UploadApiBatchResponse {
  const rawBilling = batch.billing as
    | UploadApiBatchResponse["billing"]
    | {
        reserveMicrocredits?: unknown;
        settledMicrocredits?: unknown;
        creditStatus?: unknown;
      }
    | undefined;
  if (!rawBilling) return batch;

  if (
    "reserveOctas" in rawBilling &&
    Number.isSafeInteger(rawBilling.reserveOctas) &&
    typeof rawBilling.paymentStatus === "string"
  ) {
    return batch;
  }

  if (
    "reserveMicrocredits" in rawBilling &&
    Number.isSafeInteger(rawBilling.reserveMicrocredits) &&
    (rawBilling.creditStatus === "reserved" ||
      rawBilling.creditStatus === "settled" ||
      rawBilling.creditStatus === "payment_required")
  ) {
    return {
      ...batch,
      billing: {
        reserveOctas: rawBilling.reserveMicrocredits as number,
        settledOctas: Number.isSafeInteger(rawBilling.settledMicrocredits)
          ? (rawBilling.settledMicrocredits as number)
          : undefined,
        paymentStatus: rawBilling.creditStatus as
          | "reserved"
          | "settled"
          | "payment_required",
      },
    };
  }

  return { ...batch, billing: undefined };
}
