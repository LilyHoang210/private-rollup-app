import { describe, expect, it } from "vitest";
import { Account } from "@aptos-labs/ts-sdk";
import { POST as createChallenge } from "../../src/app/api/auth/challenge/route";
import { POST as logout } from "../../src/app/api/auth/logout/route";
import { GET as getSession } from "../../src/app/api/auth/session/route";
import { POST as verifyChallenge } from "../../src/app/api/auth/verify/route";

describe("auth API routes", () => {
  it("creates and verifies a signed Aptos wallet challenge through HTTP handlers", async () => {
    const account = Account.generate();

    const challengeResponse = await createChallenge(
      new Request("http://localhost/api/auth/challenge", {
        method: "POST",
        body: JSON.stringify({
          walletAddress: account.accountAddress.toStringLong(),
          domain: "localhost",
          uri: "http://localhost",
          chainId: "aptos-shelbynet",
        }),
      }),
    );
    const challenge = await challengeResponse.json();

    expect(challengeResponse.status).toBe(200);
    expect(challenge.id).toEqual(expect.any(String));
    expect(challenge.message).toContain("aptos-shelbynet");

    const verifyResponse = await verifyChallenge(
      new Request("http://localhost/api/auth/verify", {
        method: "POST",
          body: JSON.stringify({
            challengeId: challenge.id,
            walletAddress: account.accountAddress.toStringLong(),
            publicKey: account.publicKey.toString(),
            domain: "localhost",
            signature: account.privateKey.signText(challenge.message).toString(),
          }),
        }),
      );

    expect(verifyResponse.status).toBe(200);
    const setCookie = verifyResponse.headers.get("set-cookie");
    expect(setCookie).toContain("HttpOnly");
    expect(await verifyResponse.json()).toMatchObject({
      chainId: "aptos-shelbynet",
    });

    const sessionResponse = await getSession(
      new Request("http://localhost/api/auth/session", {
        headers: { Cookie: setCookie?.split(";")[0] ?? "" },
      }),
    );

    expect(sessionResponse.status).toBe(200);
    await expect(sessionResponse.json()).resolves.toMatchObject({
      authenticated: true,
      chainId: "aptos-shelbynet",
      walletAddressHash: expect.any(String),
    });
  });

  it("clears the wallet session cookie on logout", async () => {
    const response = await logout();

    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain("pr_session=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
