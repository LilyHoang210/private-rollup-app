import { describe, expect, it, vi } from "vitest";
import {
  assertVaultReservationReady,
  verifyVaultReservationTransaction,
} from "@/server/vault/payment-vault-service";

describe("Payment Vault reservation verification", () => {
  const baseInput = {
    userId: "wallet:user",
    userAddress: "0xabc" as const,
    vaultRequestId: "vault-request-1",
    reservationTransactionHash: `0x${"12".repeat(32)}`,
    reservationDeadlineSecs: 1_800_000_000,
    expectedEncryptedBytes: 1_024,
    expectedRetentionDays: "90" as const,
    contractAddress: "0x42" as const,
  };

  it("accepts a successful upload_with_payment transaction for the expected user and request", async () => {
    const getTransactionByHash = vi.fn().mockResolvedValue({
      type: "user_transaction",
      success: true,
      sender: "0xabc",
      payload: {
        function: "0x42::payment_vault::upload_with_payment",
        arguments: [
          "0x7661756c742d726571756573742d31",
          "1024",
          "90",
          0,
          "0x" + "aa".repeat(32),
          "0x" + "bb".repeat(32),
          "4000",
          "192",
          "210",
          "881",
          "1800000000",
        ],
      },
    });

    await expect(
      verifyVaultReservationTransaction(baseInput, {
        aptosClient: { getTransactionByHash },
      }),
    ).resolves.toBeUndefined();
  });

  it("accepts canonical padded Move function addresses", async () => {
    const getTransactionByHash = vi.fn().mockResolvedValue({
      type: "user_transaction",
      success: true,
      sender: "0x0000000000000000000000000000000000000000000000000000000000000abc",
      payload: {
        function:
          "0x0000000000000000000000000000000000000000000000000000000000000042::payment_vault::upload_with_payment",
        arguments: [
          Array.from(new TextEncoder().encode("vault-request-1")),
          1_024,
          90,
        ],
      },
    });

    await expect(
      verifyVaultReservationTransaction(baseInput, {
        aptosClient: { getTransactionByHash },
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects a reservation hash with missing upload_with_payment arguments", async () => {
    const getTransactionByHash = vi.fn().mockResolvedValue({
      type: "user_transaction",
      success: true,
      sender: "0xabc",
      payload: {
        function: "0x42::payment_vault::upload_with_payment",
        arguments: ["0x7661756c742d726571756573742d31"],
      },
    });

    await expect(
      verifyVaultReservationTransaction(baseInput, {
        aptosClient: { getTransactionByHash },
      }),
    ).rejects.toThrow("Payment Vault reservation transaction arguments are incomplete");
  });

  it("rejects a reservation hash that points to a different function", async () => {
    const getTransactionByHash = vi.fn().mockResolvedValue({
      type: "user_transaction",
      success: true,
      sender: "0xabc",
      payload: {
        function: "0x42::payment_vault::withdraw_refund",
        arguments: ["0x7661756c742d726571756573742d31"],
      },
    });

    await expect(
      verifyVaultReservationTransaction(baseInput, {
        aptosClient: { getTransactionByHash },
      }),
    ).rejects.toThrow("Payment Vault reservation transaction does not call upload_with_payment");
  });

  it("rejects a reservation hash from a different wallet", async () => {
    const getTransactionByHash = vi.fn().mockResolvedValue({
      type: "user_transaction",
      success: true,
      sender: "0xdef",
      payload: {
        function: "0x42::payment_vault::upload_with_payment",
        arguments: ["0x7661756c742d726571756573742d31"],
      },
    });

    await expect(
      verifyVaultReservationTransaction(baseInput, {
        aptosClient: { getTransactionByHash },
      }),
    ).rejects.toThrow("Payment Vault reservation sender does not match the connected wallet");
  });

  it("rejects malformed transaction hashes before calling the fullnode", async () => {
    const getTransactionByHash = vi.fn();

    await expect(
      verifyVaultReservationTransaction(
        { ...baseInput, reservationTransactionHash: "0xabc123" },
        { aptosClient: { getTransactionByHash } },
      ),
    ).rejects.toThrow("Payment Vault reservation transaction is invalid");

    expect(getTransactionByHash).not.toHaveBeenCalled();
  });

  it("maps fullnode lookup failures to an unavailable reservation transaction", async () => {
    const getTransactionByHash = vi
      .fn()
      .mockRejectedValue(new Error("transaction not found"));

    await expect(
      verifyVaultReservationTransaction(baseInput, {
        aptosClient: { getTransactionByHash },
      }),
    ).rejects.toThrow("Payment Vault reservation transaction is unavailable");
  });

  it("keeps the local shape validation available for non-durable tests", () => {
    expect(() => assertVaultReservationReady(baseInput)).not.toThrow();
  });
});
