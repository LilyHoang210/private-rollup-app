// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UploadApiBatchResponse } from "@/client/api/uploads";
import { downloadBatchReceipt } from "@/client/recovery/receipt-download";

describe("receipt download", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("downloads a receipt through an attached anchor and revokes the blob URL asynchronously", () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:receipt-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });
    const click = vi.fn();
    const anchor = document.createElement("a");
    vi.spyOn(anchor, "click").mockImplementation(click);
    const createElement = vi.spyOn(document, "createElement").mockReturnValue(anchor);

    const result = downloadBatchReceipt(receiptBatchFixture());

    expect(result).toBe(true);
    expect(createElement).toHaveBeenCalledWith("a");
    expect(anchor.href).toBe("blob:receipt-url");
    expect(anchor.download).toBe("batch-1.receipt.json");
    expect(document.body.contains(anchor)).toBe(false);
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:receipt-url");
    vi.useRealTimers();
  });
});

function receiptBatchFixture(): UploadApiBatchResponse {
  return {
    id: "batch-1",
    status: "available",
    retentionDays: 90,
    totalCiphertextSizeBytes: 75,
    storage: {
      driver: "shelby",
      network: "shelbynet",
      verified: true,
      ownerAddress: `0x${"a".repeat(64)}`,
      blobId: "80989614546185216",
      blobName: "private-rollup/pack-1.prp",
      blobSizeBytes: 874,
      ciphertextSha256: "f".repeat(64),
      transactionHash: `0x${"b".repeat(64)}`,
      expiresAt: "2026-11-10T11:43:48.266Z",
      downloadUrl: "https://api.shelbynet.shelby.xyz/shelby/v1/blobs/owner/name",
    },
    items: [
      {
        id: "item-1",
        localId: "local-1",
        label: "Smoke upload",
        category: "document",
        mimeType: "text/plain",
        plaintextSizeBytes: 59,
        ciphertextSizeBytes: 75,
        ciphertextSha256: "c".repeat(64),
        encryptedManifest: "manifest",
        wrappedDek: "dek",
        status: "available",
        packStrategy: "shared_pack",
      },
    ],
    createdAt: "2026-08-12T11:43:02.807Z",
  };
}
