import { describe, expect, it } from "vitest";
import {
  AuthService,
  InMemoryAuthStore,
  SignedChallengeStore,
  type WalletSignatureVerifier,
} from "../../src/server/auth/challenge";

const verifier: WalletSignatureVerifier = {
  verify: async ({ message, signature }) =>
    signature === `signed:${message}`,
};

describe("wallet auth challenge", () => {
  const now = new Date("2026-07-31T00:00:00.000Z");

  it("accepts a valid challenge once and rejects replay", async () => {
    const service = new AuthService(new InMemoryAuthStore(), verifier);
    const challenge = await service.createChallenge({
      walletAddress: "0xabc",
      domain: "private-rollup.local",
      uri: "http://private-rollup.local",
      chainId: "aptos-shelbynet",
      now,
    });

    const verified = await service.verifyChallenge({
      challengeId: challenge.id,
      walletAddress: "0xabc",
      domain: "private-rollup.local",
      signature: `signed:${challenge.message}`,
      now,
    });

    expect(verified.walletAddressHash).toHaveLength(64);
    await expect(
      service.verifyChallenge({
        challengeId: challenge.id,
        walletAddress: "0xabc",
        domain: "private-rollup.local",
        signature: `signed:${challenge.message}`,
        now,
      }),
    ).rejects.toThrow("already used");
  });

  it("rejects expired and wrong-domain challenges", async () => {
    const service = new AuthService(new InMemoryAuthStore(), verifier);
    const challenge = await service.createChallenge({
      walletAddress: "0xabc",
      domain: "private-rollup.local",
      uri: "http://private-rollup.local",
      chainId: "aptos-shelbynet",
      now,
    });

    await expect(
      service.verifyChallenge({
        challengeId: challenge.id,
        walletAddress: "0xabc",
        domain: "evil.example",
        signature: `signed:${challenge.message}`,
        now,
      }),
    ).rejects.toThrow("domain");

    await expect(
      service.verifyChallenge({
        challengeId: challenge.id,
        walletAddress: "0xabc",
        domain: "private-rollup.local",
        signature: `signed:${challenge.message}`,
        now: new Date("2026-07-31T00:06:00.000Z"),
      }),
    ).rejects.toThrow("expired");
  });

  it("verifies a signed challenge across independent server instances", async () => {
    const issuer = new AuthService(
      new SignedChallengeStore({ secret: "test-challenge-secret" }),
      verifier,
    );
    const verifierService = new AuthService(
      new SignedChallengeStore({ secret: "test-challenge-secret" }),
      verifier,
    );
    const challenge = await issuer.createChallenge({
      walletAddress: "0xabc",
      domain: "private-rollup.local",
      uri: "http://private-rollup.local",
      chainId: "aptos-shelbynet",
      now,
    });

    expect(challenge.id).not.toMatch(/^[0-9a-f-]{36}$/);

    await expect(
      verifierService.verifyChallenge({
        challengeId: challenge.id,
        walletAddress: "0xabc",
        domain: "private-rollup.local",
        signature: `signed:${challenge.message}`,
        now,
      }),
    ).resolves.toMatchObject({
      chainId: "aptos-shelbynet",
      walletAddress: "0xabc",
    });
  });
});
