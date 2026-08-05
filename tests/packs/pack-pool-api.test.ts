import { afterEach, describe, expect, it } from "vitest";
import { GET as getPackPools } from "../../src/app/api/packs/pool/route";
import { createSessionCookie, createSessionToken } from "../../src/server/auth/session";
import { recordWalletDeposit, resetAptStoreForTests } from "../../src/server/billing/apt-account-service";
import { completeUploadBatch, createUploadBatch, resetUploadStoreForTests } from "../../src/server/uploads/service";

describe("pack pool API", () => {
  afterEach(() => {
    resetUploadStoreForTests();
    resetAptStoreForTests();
  });

  it("requires a wallet session", async () => {
    const response = await getPackPools(new Request("http://localhost/api/packs/pool"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "AUTH_REQUIRED" });
  });

  it("returns waiting shared pack pool progress for the signed wallet", async () => {
    const userId = `wallet:${"a".repeat(64)}`;
    recordWalletDeposit({
      userId,
      depositId: "pool-deposit",
      amountOctas: 100_000_000,
    });
    const created = createUploadBatch({
      userId,
      idempotencyKey: "pool-upload",
      retentionDays: 90,
      items: [
        {
          localId: "file-1",
          label: "Pool file",
          category: "document",
          plaintextSizeBytes: 1000,
          ciphertextSizeBytes: 1016,
          ciphertextSha256: "a".repeat(64),
          encryptedManifest: "manifest",
          wrappedDek: "dek",
        },
      ],
    });
    completeUploadBatch({
      userId,
      batchId: created.id,
      items: [
        {
          localId: "file-1",
          ciphertextSha256: "a".repeat(64),
          stagingRef: "private-staging",
        },
      ],
    });

    const response = await getPackPools(
      new Request("http://localhost/api/packs/pool", {
        headers: authHeaders("a".repeat(64)),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          retentionDays: 90,
          queuedBytes: 1016,
          waitingBatchCount: 1,
          targetBytes: 8 * 1024 * 1024,
          maxBytes: 50 * 1024 * 1024,
          userBatchIds: [created.id],
        }),
      ]),
    );
  });
});

function authHeaders(walletAddressHash: string) {
  const token = createSessionToken({
    walletAddressHash,
    chainId: "aptos-testnet",
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
