import { describe, expect, it } from "vitest";
import { connectDemoWallet } from "../../src/client/api/auth";

describe("auth client API", () => {
  it("requests a challenge then verifies the demo signature", async () => {
    const calls: string[] = [];
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(String(input));
      const body = JSON.parse(String(init?.body));

      if (String(input) === "/api/auth/challenge") {
        return Response.json({ id: "challenge-id", message: "message" });
      }

      expect(body.signature).toBe("signed:message");
      return Response.json({ chainId: "aptos-testnet" });
    };

    const result = await connectDemoWallet(
      {
        walletAddress: "0xabc",
        domain: "localhost",
        uri: "http://localhost",
        chainId: "aptos-testnet",
      },
      fetcher,
    );

    expect(result.chainId).toBe("aptos-testnet");
    expect(calls).toEqual(["/api/auth/challenge", "/api/auth/verify"]);
  });
});
