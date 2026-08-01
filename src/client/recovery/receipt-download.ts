import type { UploadApiBatchResponse } from "@/client/api/uploads";

export function downloadBatchReceipt(batch: UploadApiBatchResponse) {
  if (!batch.storage || !globalThis.URL?.createObjectURL) return false;
  const receipt = {
    format: "private-rollup-receipt",
    formatVersion: 1,
    batchId: batch.id,
    storage: batch.storage,
    retentionDays: batch.retentionDays,
    items: batch.items.map((item) => ({
      id: item.id,
      localId: item.localId,
      label: item.label,
      category: item.category,
      mimeType: item.mimeType,
      ciphertextSizeBytes: item.ciphertextSizeBytes,
      ciphertextSha256: item.ciphertextSha256,
      encryptedManifest: item.encryptedManifest,
      wrappedDek: item.wrappedDek,
    })),
    createdAt: batch.createdAt,
  };
  const url = globalThis.URL.createObjectURL(
    new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${batch.id}.receipt.json`;
  anchor.click();
  globalThis.URL.revokeObjectURL?.(url);
  return true;
}
