import { afterEach, describe, expect, it } from "vitest";
import {
  completeUploadBatch,
  createUploadBatch,
  getUploadBatch,
  listUploadBatchesForUser,
  resetUploadStoreForTests,
} from "../../src/server/uploads/service";
import { resetCreditStoreForTests } from "../../src/server/billing/credit-service";

describe("upload service", () => {
  const baseItem = {
    localId: "file-1",
    label: "Tax documents",
    category: "document" as const,
    mimeType: "application/pdf",
    plaintextSizeBytes: 128_000,
    ciphertextSizeBytes: 128_016,
    ciphertextSha256: "a".repeat(64),
    encryptedManifest: "encrypted-manifest",
    wrappedDek: "hpke-wrapped-dek",
  };

  afterEach(() => {
    resetUploadStoreForTests();
    resetCreditStoreForTests();
  });

  it("creates idempotent batches and assigns pack strategy per item size", () => {
    const first = createUploadBatch({
      userId: "demo-user",
      idempotencyKey: "idem-1",
      retentionDays: 90,
      items: [
        baseItem,
        {
          ...baseItem,
          localId: "file-2",
          label: "Large archive",
          category: "archive",
          ciphertextSizeBytes: 20 * 1024 * 1024,
          ciphertextSha256: "b".repeat(64),
        },
      ],
    });
    const second = createUploadBatch({
      userId: "demo-user",
      idempotencyKey: "idem-1",
      retentionDays: 90,
      items: [baseItem],
    });

    expect(second.id).toBe(first.id);
    expect(first.status).toBe("staging");
    expect(first.items.map((item) => item.packStrategy)).toEqual([
      "shared_pack",
      "dedicated_blob",
    ]);
    expect(first.totalCiphertextSizeBytes).toBe(21_099_536);
  });

  it("does not accept plaintext payload fields", () => {
    expect(() =>
      createUploadBatch({
        userId: "demo-user",
        idempotencyKey: "idem-plaintext",
        retentionDays: 30,
        items: [{ ...baseItem, plaintextBytes: "leak" } as typeof baseItem],
      }),
    ).toThrow("Plaintext payload fields are not accepted");
  });

  it("does not retain a batch when credit reserve fails", () => {
    expect(() =>
      createUploadBatch({
        userId: "demo-user",
        idempotencyKey: "idem-insufficient-credit",
        retentionDays: 365,
        items: [
          {
            ...baseItem,
            ciphertextSizeBytes: 512 * 1024 * 1024,
            ciphertextSha256: "d".repeat(64),
          },
        ],
      }),
    ).toThrow("Insufficient credit for upload reserve");

    expect(listUploadBatchesForUser("demo-user")).toEqual([]);
  });

  it("completes staging only when ciphertext checksums match", () => {
    const created = createUploadBatch({
      userId: "demo-user",
      idempotencyKey: "idem-2",
      retentionDays: 365,
      items: [baseItem],
    });

    const completed = completeUploadBatch({
      userId: "demo-user",
      batchId: created.id,
      items: [
        {
          localId: "file-1",
          ciphertextSha256: baseItem.ciphertextSha256,
          stagingRef: "staging://uploads/file-1",
        },
      ],
    });

    expect(completed.status).toBe("waiting_for_pack");
    expect(completed.items[0]).toMatchObject({
      status: "waiting_for_pack",
      stagingRef: "staging://uploads/file-1",
    });
    expect(getUploadBatch(created.id, "demo-user")?.status).toBe("waiting_for_pack");
  });

  it("lists only the current user's newest upload batches", () => {
    const older = createUploadBatch({
      userId: "demo-user",
      idempotencyKey: "idem-list-1",
      retentionDays: 30,
      items: [baseItem],
    });
    const newer = createUploadBatch({
      userId: "demo-user",
      idempotencyKey: "idem-list-2",
      retentionDays: 90,
      items: [
        {
          ...baseItem,
          localId: "file-2",
          label: "Research dataset",
          category: "dataset",
          ciphertextSha256: "f".repeat(64),
        },
      ],
    });
    createUploadBatch({
      userId: "other-user",
      idempotencyKey: "idem-list-other",
      retentionDays: 365,
      items: [baseItem],
    });

    expect(listUploadBatchesForUser("demo-user").map((batch) => batch.id)).toEqual([
      newer.id,
      older.id,
    ]);
  });

  it("marks a batch failed on checksum mismatch", () => {
    const created = createUploadBatch({
      userId: "demo-user",
      idempotencyKey: "idem-3",
      retentionDays: 90,
      items: [baseItem],
    });

    expect(() =>
      completeUploadBatch({
        userId: "demo-user",
        batchId: created.id,
        items: [
          {
            localId: "file-1",
            ciphertextSha256: "c".repeat(64),
            stagingRef: "staging://uploads/file-1",
          },
        ],
      }),
    ).toThrow("Ciphertext checksum mismatch");

    const failed = getUploadBatch(created.id, "demo-user");
    expect(failed?.status).toBe("failed");
    expect(failed?.items[0].status).toBe("failed");
  });
});
