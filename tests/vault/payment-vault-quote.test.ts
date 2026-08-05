import { describe, expect, it } from "vitest";
import { quoteVaultUpload } from "@/server/vault/payment-vault-quote";

describe("vault upload quote", () => {
  it("quotes shared pack upload with Shelby fee, storage fee, platform fee, and buffer", () => {
    const quote = quoteVaultUpload({
      encryptedSizeBytes: 1_048_576,
      retentionDays: "90",
      mode: "shared_pack",
    });

    expect(quote).toEqual({
      encryptedSizeBytes: 1_048_576,
      retentionDays: "90",
      mode: "shared_pack",
      estimatedShelbyFeeOctas: 4_000,
      estimatedStorageFeeOctas: 196_608,
      platformFeeOctas: 10_031,
      safetyBufferOctas: 42_128,
      totalLockedOctas: 252_767,
      refundPolicy: "full_refund_before_success_settlement",
    });
  });

  it("rejects unsafe byte counts", () => {
    expect(() =>
      quoteVaultUpload({
        encryptedSizeBytes: -1,
        retentionDays: "30",
        mode: "shared_pack",
      }),
    ).toThrow("Encrypted size must be a positive safe integer");
  });
});
