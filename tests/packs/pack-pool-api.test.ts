import { afterEach, describe, expect, it } from "vitest";
import { GET as getPackPools } from "../../src/app/api/packs/pool/route";
import { recordWalletDeposit, resetAptStoreForTests } from "../../src/server/billing/apt-account-service";
import { completeUploadBatch, createUploadBatch, resetUploadStoreForTests } from "../../src/server/uploads/service";

const validReservationTransactionHash = `0x${"12".repeat(32)}`;

describe("pack pool API", () => {
  afterEach(() => {
    resetUploadStoreForTests();
    resetAptStoreForTests();
  });

  it("returns public empty aggregate pools without a wallet session", async () => {
    const response = await getPackPools();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pools).toEqual([
      expect.objectContaining({ retentionDays: 30, queuedBytes: 0, waitingBatchCount: 0 }),
      expect.objectContaining({ retentionDays: 90, queuedBytes: 0, waitingBatchCount: 0 }),
      expect.objectContaining({ retentionDays: 365, queuedBytes: 0, waitingBatchCount: 0 }),
    ]);
  });

  it("returns aggregate shared pack progress without leaking private batch data", async () => {
    const first = queueSharedUpload({
      userId: `wallet:${"a".repeat(64)}`,
      idempotencyKey: "pool-upload-a",
      label: "First private label",
      ciphertextSizeBytes: 1016,
      hashChar: "a",
    });
    const second = queueSharedUpload({
      userId: `wallet:${"b".repeat(64)}`,
      idempotencyKey: "pool-upload-b",
      label: "Second private label",
      ciphertextSizeBytes: 2048,
      hashChar: "b",
    });

    const response = await getPackPools();
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.pools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          retentionDays: 90,
          queuedBytes: 3064,
          waitingBatchCount: 2,
          targetBytes: 8 * 1024 * 1024,
          maxBytes: 50 * 1024 * 1024,
        }),
      ]),
    );
    expect(serialized).not.toContain(first.id);
    expect(serialized).not.toContain(second.id);
    expect(serialized).not.toContain("First private label");
    expect(serialized).not.toContain("Second private label");
    expect(serialized).not.toContain("wallet:");
  });
});

function queueSharedUpload(input: {
  userId: string;
  idempotencyKey: string;
  label: string;
  ciphertextSizeBytes: number;
  hashChar: string;
}) {
  recordWalletDeposit({
    userId: input.userId,
    depositId: `${input.idempotencyKey}-deposit`,
    amountOctas: 100_000_000,
  });
  const created = createUploadBatch({
    userId: input.userId,
    userAddress: "0xabc",
    vaultRequestId: `vault-${input.idempotencyKey}`,
    reservationTransactionHash: validReservationTransactionHash,
    reservationDeadlineSecs: 1_800_000_000,
    idempotencyKey: input.idempotencyKey,
    retentionDays: 90,
    items: [
      {
        localId: "file-1",
        label: input.label,
        category: "document",
        plaintextSizeBytes: input.ciphertextSizeBytes - 16,
        ciphertextSizeBytes: input.ciphertextSizeBytes,
        ciphertextSha256: input.hashChar.repeat(64),
        encryptedManifest: "manifest",
        wrappedDek: "dek",
      },
    ],
  });
  return completeUploadBatch({
    userId: input.userId,
    batchId: created.id,
    items: [
      {
        localId: "file-1",
        ciphertextSha256: input.hashChar.repeat(64),
        stagingRef: "private-staging",
      },
    ],
  });
}
