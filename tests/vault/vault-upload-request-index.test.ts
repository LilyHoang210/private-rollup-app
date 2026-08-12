import { describe, expect, it } from "vitest";
import { buildVaultUploadRequestIndexRecord } from "@/server/uploads/durable-service";

describe("vault upload request index", () => {
  const validReservationTransactionHash = `0x${"12".repeat(32)}`;

  it("builds the durable index row from the signed vault reservation", () => {
    const record = buildVaultUploadRequestIndexRecord({
      userId: "11111111-1111-4111-8111-111111111111",
      uploadBatchId: "22222222-2222-4222-8222-222222222222",
      userAddress: "0xabc",
      vaultRequestId: "vault-index-1",
      reservationTransactionHash: validReservationTransactionHash,
      reservationDeadlineSecs: 1_800_000_000,
      retentionDays: "90",
      encryptedSizeBytes: 1_048_576,
      contractAddress: "0x42",
    });

    expect(record).toMatchObject({
      userId: "11111111-1111-4111-8111-111111111111",
      uploadBatchId: "22222222-2222-4222-8222-222222222222",
      requestId: "vault-index-1",
      userAddress: "0xabc",
      contractAddress: "0x42",
      status: "reserved",
      encryptedSizeBytes: 1_048_576,
      retentionDays: "90",
      mode: "shared_pack",
      estimatedShelbyFeeOctas: 4_000,
      estimatedStorageFeeOctas: 196_608,
      platformFeeOctas: 10_031,
      safetyBufferOctas: 42_128,
      totalLockedOctas: 252_767,
      transactionHash: validReservationTransactionHash,
    });
    expect(record.deadlineAt).toEqual(new Date("2027-01-15T08:00:00.000Z"));
  });
});
