import { afterEach, describe, expect, it } from "vitest";
import {
  getAptAccount,
  recordWalletDeposit,
  recordWithdrawal,
  reserveUploadApt,
  resetAptStoreForTests,
  settlePackCostByBytes,
} from "../../src/server/billing/apt-account-service";

describe("APT ledger service", () => {
  afterEach(() => {
    resetAptStoreForTests();
  });

  it("starts at zero until an on-chain wallet deposit is recorded", () => {
    const account = getAptAccount("user-a");

    expect(account.balanceOctas).toBe(0);
    expect(account.reservedOctas).toBe(0);
    expect(account.availableOctas).toBe(0);
    expect(account.ledger).toEqual([]);

    const deposited = recordWalletDeposit({
      userId: "user-a",
      depositId: "tx-1",
      amountOctas: 100_000_000,
    });
    expect(deposited.balanceOctas).toBe(100_000_000);
    expect(deposited.ledger[0]).toMatchObject({
      type: "wallet_deposit",
      amountOctas: 100_000_000,
    });
  });

  it("reserves real APT and reduces the withdrawable amount", () => {
    recordWalletDeposit({
      userId: "user-a",
      depositId: "tx-reserve",
      amountOctas: 100_000_000,
    });
    const reservation = reserveUploadApt({
      userId: "user-a",
      uploadId: "upload-1",
      ciphertextBytes: 2048,
      retentionDays: 90,
    });
    const account = getAptAccount("user-a");

    expect(reservation.paymentStatus).toBe("reserved");
    expect(reservation.reserveOctas).toBeGreaterThan(0);
    expect(account.reservedOctas).toBe(reservation.reserveOctas);
    expect(account.availableOctas).toBe(
      account.balanceOctas - reservation.reserveOctas,
    );
  });

  it("withdraws only unreserved APT", () => {
    recordWalletDeposit({
      userId: "user-a",
      depositId: "tx-withdraw",
      amountOctas: 1_000_000,
    });
    const billing = reserveUploadApt({
      userId: "user-a",
      uploadId: "upload-withdraw",
      ciphertextBytes: 1024,
      retentionDays: 30,
    });

    const withdrawn = recordWithdrawal({
      userId: "user-a",
      withdrawalId: "withdrawal-1",
      amountOctas: 999_500,
    });

    expect(withdrawn.availableOctas).toBe(0);
    expect(withdrawn.reservedOctas).toBe(billing.reserveOctas);
    expect(withdrawn.ledger[0]).toMatchObject({
      type: "withdrawal",
      amountOctas: -999_500,
    });
    expect(() =>
      recordWithdrawal({
        userId: "user-a",
        withdrawalId: "withdrawal-2",
        amountOctas: 1,
      }),
    ).toThrow("Insufficient available APT");
  });

  it("settles pack cost by encrypted bytes and releases reserves", () => {
    recordWalletDeposit({
      userId: "user-a",
      depositId: "tx-a",
      amountOctas: 100_000_000,
    });
    recordWalletDeposit({
      userId: "user-b",
      depositId: "tx-b",
      amountOctas: 100_000_000,
    });
    reserveUploadApt({
      userId: "user-a",
      uploadId: "upload-a",
      ciphertextBytes: 10,
      retentionDays: 90,
    });
    reserveUploadApt({
      userId: "user-b",
      uploadId: "upload-b",
      ciphertextBytes: 40,
      retentionDays: 90,
    });

    const result = settlePackCostByBytes({
      packId: "pack-1",
      totalCostOctas: 500_000,
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
        costOctas: 100_000,
        status: "settled",
      },
      {
        userId: "user-b",
        uploadId: "upload-b",
        ciphertextBytes: 40,
        costOctas: 400_000,
        status: "settled",
      },
    ]);
    expect(getAptAccount("user-a").reservedOctas).toBe(0);
    expect(getAptAccount("user-a").balanceOctas).toBe(99_900_000);
    expect(getAptAccount("user-b").balanceOctas).toBe(99_600_000);
  });
});
