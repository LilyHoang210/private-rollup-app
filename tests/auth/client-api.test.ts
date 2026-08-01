import { describe, expect, it } from "vitest";
import {
  createWalletChallenge,
  verifyWalletChallenge,
} from "../../src/client/api/auth";

describe("auth client API", () => {
  it("requests a wallet challenge", async () => {
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/auth/challenge");
      expect(JSON.parse(String(init?.body))).toMatchObject({
        walletAddress: "0xabc",
        chainId: "aptos-testnet",
      });

      return Response.json({
        id: "challenge-id",
        message: "message",
        expiresAt: "2026-08-01T00:05:00.000Z",
      });
    };

    await expect(
      createWalletChallenge(
        {
          walletAddress: "0xabc",
          domain: "localhost",
          uri: "http://localhost",
          chainId: "aptos-testnet",
        },
        fetcher,
      ),
    ).resolves.toMatchObject({
      id: "challenge-id",
      message: "message",
    });
  });

  it("verifies a wallet challenge with public key, signature, and optional wallet full message", async () => {
    const calls: string[] = [];
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(String(input));
      const body = JSON.parse(String(init?.body));

      expect(body).toMatchObject({
        challengeId: "challenge-id",
        walletAddress: "0xabc",
        publicKey: "0xpublic",
        signature: "0xsig",
        fullMessage: "APTOS\nmessage",
      });
      return Response.json({ chainId: "aptos-testnet" });
    };

    const result = await verifyWalletChallenge(
      {
        challengeId: "challenge-id",
        walletAddress: "0xabc",
        publicKey: "0xpublic",
        domain: "localhost",
        signature: "0xsig",
        fullMessage: "APTOS\nmessage",
      },
      fetcher,
    );

    expect(result.chainId).toBe("aptos-testnet");
    expect(calls).toEqual(["/api/auth/verify"]);
  });
});
