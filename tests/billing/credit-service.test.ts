import { afterEach, describe, expect, it } from "vitest";
import {
  getCreditAccount,
  reserveUploadCredit,
  resetCreditStoreForTests,
  settlePackCostByBytes,
} from "../../src/server/billing/credit-service";

describe("credit ledger service", () => {
  afterEach(() => {
    resetCreditStoreForTests();
  });

  it("grants a testnet credit balance to new users", () => {
    const account = getCreditAccount("user-a");

    expect(account.balanceMicrocredits).toBe(100_000_000);
    expect(account.reservedMicrocredits).toBe(0);
    expect(account.availableMicrocredits).toBe(100_000_000);
    expect(account.ledger[0]).toMatchObject({
      type: "testnet_grant",
      amountMicrocredits: 100_000_000,
    });
  });

  it("reserves upload credit and reduces available balance", () => {
    const reservation = reserveUploadCredit({
      userId: "user-a",
      uploadId: "upload-1",
      ciphertextBytes: 2048,
      retentionDays: 90,
    });
    const account = getCreditAccount("user-a");

    expect(reservation.creditStatus).toBe("reserved");
    expect(reservation.reserveMicrocredits).toBeGreaterThan(0);
    expect(account.reservedMicrocredits).toBe(reservation.reserveMicrocredits);
    expect(account.availableMicrocredits).toBe(
      account.balanceMicrocredits - reservation.reserveMicrocredits,
    );
  });

  it("settles pack cost by encrypted bytes and releases reserves", () => {
    reserveUploadCredit({
      userId: "user-a",
      uploadId: "upload-a",
      ciphertextBytes: 10,
      retentionDays: 90,
    });
    reserveUploadCredit({
      userId: "user-b",
      uploadId: "upload-b",
      ciphertextBytes: 40,
      retentionDays: 90,
    });

    const result = settlePackCostByBytes({
      packId: "pack-1",
      totalCostMicrocredits: 500_000,
      members: [
        { userId: "user-a", uploadId: "upload-a", ciphertextBytes: 10 },
        { userId: "user-b", uploadId: "upload-b", ciphertextBytes: 40 },
      ],
    });

    expect(result.allocations).toEqual([
      {
        userId: "user-a",
        uploadId: "upload-a",
        ciphertextBytes: 10,
        costMicrocredits: 100_000,
        status: "settled",
      },
      {
        userId: "user-b",
        uploadId: "upload-b",
        ciphertextBytes: 40,
        costMicrocredits: 400_000,
        status: "settled",
      },
    ]);
    expect(getCreditAccount("user-a").reservedMicrocredits).toBe(0);
    expect(getCreditAccount("user-a").balanceMicrocredits).toBe(99_900_000);
    expect(getCreditAccount("user-b").balanceMicrocredits).toBe(99_600_000);
  });
});
