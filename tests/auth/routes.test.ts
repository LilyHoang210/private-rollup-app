import { describe, expect, it } from "vitest";
import { POST as createChallenge } from "../../src/app/api/auth/challenge/route";
import { POST as verifyChallenge } from "../../src/app/api/auth/verify/route";

describe("auth API routes", () => {
  it("creates and verifies a demo wallet challenge through HTTP handlers", async () => {
    const challengeResponse = await createChallenge(
      new Request("http://localhost/api/auth/challenge", {
        method: "POST",
        body: JSON.stringify({
          walletAddress: "0xabc",
          domain: "localhost",
          uri: "http://localhost",
          chainId: "aptos-testnet",
        }),
      }),
    );
    const challenge = await challengeResponse.json();

    expect(challengeResponse.status).toBe(200);
    expect(challenge.id).toEqual(expect.any(String));
    expect(challenge.message).toContain("aptos-testnet");

    const verifyResponse = await verifyChallenge(
      new Request("http://localhost/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({
          challengeId: challenge.id,
          walletAddress: "0xabc",
          domain: "localhost",
          signature: `signed:${challenge.message}`,
        }),
      }),
    );

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.headers.get("set-cookie")).toContain("HttpOnly");
    expect(await verifyResponse.json()).toMatchObject({
      chainId: "aptos-testnet",
    });
  });
});
