import { afterEach, describe, expect, it } from "vitest";
import { GET } from "../../src/app/api/credits/route";
import {
  createSessionCookie,
  createSessionToken,
} from "../../src/server/auth/session";
import { resetCreditStoreForTests } from "../../src/server/billing/credit-service";

describe("credit API route", () => {
  afterEach(() => {
    resetCreditStoreForTests();
  });

  it("returns wallet-scoped credit account state", async () => {
    const response = await GET(
      new Request("http://localhost/api/credits", {
        headers: authHeaders("a".repeat(64)),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      account: {
          balanceMicrocredits: 100_000_000,
          reservedMicrocredits: 0,
          availableMicrocredits: 100_000_000,
        ledger: [{ type: "testnet_grant" }],
      },
    });
  });

  it("requires a wallet session", async () => {
    const response = await GET(new Request("http://localhost/api/credits"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "AUTH_REQUIRED" });
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
