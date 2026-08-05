import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as quoteVaultUpload } from "@/app/api/payment-vault/quote/route";
import { GET as getVaultStatus } from "@/app/api/payment-vault/status/route";
import {
  createSessionCookie,
  createSessionToken,
} from "@/server/auth/session";

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

  it("returns empty authenticated vault summary when no database is configured", async () => {
    vi.stubEnv("PAYMENT_VAULT_CONTRACT_ADDRESS", "0x42");
    vi.stubEnv("DATABASE_URL", "");

    const response = await getVaultStatus(
      new Request("http://localhost/api/payment-vault/status", {
        headers: authHeaders("a".repeat(64)),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      contractAddress: "0x42",
      reservedOctas: 0,
      refundableOctas: 0,
      reservations: [],
    });
  });

  it("requires authentication before returning vault summary", async () => {
    const response = await getVaultStatus(
      new Request("http://localhost/api/payment-vault/status"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "AUTH_REQUIRED" });
  });
});

function authHeaders(walletAddressHash: string) {
  const token = createSessionToken({
    walletAddressHash,
    chainId: "aptos-shelbynet",
    maxAgeSeconds: 60,
    secret: "private-rollup-dev-session-secret",
  });
  const cookie = createSessionCookie({
    token,
    maxAgeSeconds: 60,
    secure: false,
  }).split(";")[0];

  return { Cookie: cookie };
}
