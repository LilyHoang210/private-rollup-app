// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  mergeUploadBatches,
  readLocalUploadBatches,
  rememberLocalUploadBatch,
} from "../../src/client/uploads/local-upload-cache";
import type { UploadApiBatchResponse } from "../../src/client/api/uploads";

describe("local upload cache", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores recent upload batches and deduplicates by batch id", () => {
    const first = batchFixture("batch-1", "First upload", 100);
    const updated = batchFixture("batch-1", "Updated upload", 120);

    rememberLocalUploadBatch(first);
    rememberLocalUploadBatch(updated);

    expect(readLocalUploadBatches()).toEqual([updated]);
  });

  it("ignores malformed local storage instead of crashing the dashboard", () => {
    localStorage.setItem("private-rollup:upload-batches:v1", "{not json");

    expect(readLocalUploadBatches()).toEqual([]);
  });

  it("migrates legacy cached billing fields to APT octas", () => {
    const legacy = {
      ...batchFixture("legacy-batch", "Legacy upload", 100),
      billing: {
        reserveMicrocredits: 25_000,
        creditStatus: "reserved",
      },
    };
    localStorage.setItem("private-rollup:upload-batches:v1", JSON.stringify([legacy]));

    expect(readLocalUploadBatches()[0].billing).toEqual({
      reserveOctas: 25_000,
      paymentStatus: "reserved",
    });
  });

  it("merges API batches with local batches without duplicating API records", () => {
    const apiBatch = batchFixture("batch-1", "API upload", 100);
    const localOnlyBatch = batchFixture("batch-2", "Local upload", 200);
    const duplicateLocalBatch = batchFixture("batch-1", "Stale local upload", 50);

    expect(mergeUploadBatches([apiBatch], [localOnlyBatch, duplicateLocalBatch])).toEqual([
      {
        ...apiBatch,
        items: [
          {
            ...apiBatch.items[0],
            label: "Stale local upload",
          },
        ],
      },
      localOnlyBatch,
    ]);
  });
});

function batchFixture(
  id: string,
  label: string,
  totalCiphertextSizeBytes: number,
): UploadApiBatchResponse {
  return {
    id,
    status: "waiting_for_pack",
    retentionDays: 90,
    totalCiphertextSizeBytes,
    createdAt: "2026-08-01T07:15:00.000Z",
    updatedAt: "2026-08-01T07:15:01.000Z",
    items: [
      {
        id: `${id}-item`,
        localId: "local-0",
        label,
        category: "document",
        plaintextSizeBytes: totalCiphertextSizeBytes - 16,
        ciphertextSizeBytes: totalCiphertextSizeBytes,
        ciphertextSha256: "a".repeat(64),
        encryptedManifest: "manifest",
        wrappedDek: "dek",
        status: "waiting_for_pack",
        packStrategy: "shared_pack",
      },
    ],
  };
}
