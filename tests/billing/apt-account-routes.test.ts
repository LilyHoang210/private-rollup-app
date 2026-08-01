import { afterEach, describe, expect, it } from "vitest";
import { GET } from "../../src/app/api/apt-account/route";
import {
  createSessionCookie,
  createSessionToken,
} from "../../src/server/auth/session";
import { resetAptStoreForTests } from "../../src/server/billing/apt-account-service";

describe("APT account API route", () => {
  afterEach(() => {
    resetAptStoreForTests();
  });

  it("returns wallet-scoped APT account state", async () => {
    const response = await GET(
      new Request("http://localhost/api/apt-account", {
        headers: authHeaders("a".repeat(64)),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      account: {
          balanceOctas: 0,
          reservedOctas: 0,
          availableOctas: 0,
        ledger: [],
      },
    });
  });

  it("requires a wallet session", async () => {
    const response = await GET(new Request("http://localhost/api/apt-account"));

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
