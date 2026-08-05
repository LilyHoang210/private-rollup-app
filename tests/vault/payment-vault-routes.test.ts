import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as quoteVaultUpload } from "@/app/api/payment-vault/quote/route";
import { GET as getVaultStatus } from "@/app/api/payment-vault/status/route";

describe("Payment Vault API routes", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns an upload quote with Payment Vault receiver information", async () => {
    vi.stubEnv("PAYMENT_VAULT_CONTRACT_ADDRESS", "0x42");

    const response = await quoteVaultUpload(
      new Request("http://localhost/api/payment-vault/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          encryptedSizeBytes: 1_048_576,
          retentionDays: "90",
          mode: "shared_pack",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      quote: {
        totalLockedOctas: 252_767,
        refundPolicy: "full_refund_before_success_settlement",
      },
      payment: {
        payer: "connected_wallet",
        receiver: "payment_vault_contract",
        contractAddress: "0x42",
      },
    });
  });

  it("reports missing status request id clearly", async () => {
    const response = await getVaultStatus(
      new Request("http://localhost/api/payment-vault/status"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "VAULT_REQUEST_ID_REQUIRED",
    });
  });
});
