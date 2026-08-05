import { describe, expect, it } from "vitest";
import { PaymentVaultClient } from "@/server/vault/payment-vault-client";

describe("PaymentVaultClient", () => {
  it("builds upload_with_payment payload against the configured vault", () => {
    const client = new PaymentVaultClient({
      contractAddress: "0x42",
      network: "shelbynet",
    });

    const payload = client.buildUploadWithPaymentPayload({
      requestId: "req_123",
      userAddress: "0xabc",
      blobOrPackNameHash: "aa".repeat(32),
      commitmentRoot: "bb".repeat(32),
      deadlineAt: "2026-08-05T10:05:00.000Z",
      quote: {
        encryptedSizeBytes: 1_048_576,
        retentionDays: "90",
        mode: "shared_pack",
        estimatedShelbyFeeOctas: 4_000,
        estimatedStorageFeeOctas: 196_608,
        platformFeeOctas: 10_031,
        safetyBufferOctas: 42_128,
        totalLockedOctas: 252_767,
        refundPolicy: "full_refund_before_success_settlement",
      },
    });

    const data = payload.data as {
      function: string;
      functionArguments: unknown[];
    };

    expect(data.function).toBe(
      "0x42::payment_vault::upload_with_payment",
    );
    expect(data.functionArguments).toEqual(
      expect.arrayContaining([4_000, 196_608, 10_031, 42_128]),
    );
  });
});
