import { Account } from "@aptos-labs/ts-sdk";
import { describe, expect, it } from "vitest";
import { aptosWalletVerifier } from "../../src/server/auth/aptos-signature";

describe("Aptos wallet signature verifier", () => {
  it("accepts a valid Ed25519 text signature for the matching account address", async () => {
    const account = Account.generate();
    const message = "private-rollup.local wants you to sign in";
    const signature = account.privateKey.signText(message).toString();

    await expect(
      aptosWalletVerifier.verify({
        walletAddress: account.accountAddress.toStringLong(),
        publicKey: account.publicKey.toString(),
        message,
        signature,
      }),
    ).resolves.toBe(true);
  });

  it("rejects a valid signature when the public key does not derive the claimed address", async () => {
    const signer = Account.generate();
    const attacker = Account.generate();
    const message = "private-rollup.local wants you to sign in";
    const signature = signer.privateKey.signText(message).toString();

    await expect(
      aptosWalletVerifier.verify({
        walletAddress: attacker.accountAddress.toStringLong(),
        publicKey: signer.publicKey.toString(),
        message,
        signature,
      }),
    ).resolves.toBe(false);
  });

  it("verifies the wallet fullMessage only when it contains the server challenge", async () => {
    const account = Account.generate();
    const challengeMessage = "server challenge";
    const fullMessage = `APTOS\nmessage: ${challengeMessage}`;
    const signature = account.privateKey.signText(fullMessage).toString();

    await expect(
      aptosWalletVerifier.verify({
        walletAddress: account.accountAddress.toStringLong(),
        publicKey: account.publicKey.toString(),
        message: challengeMessage,
        fullMessage,
        signature,
      }),
    ).resolves.toBe(true);

    await expect(
      aptosWalletVerifier.verify({
        walletAddress: account.accountAddress.toStringLong(),
        publicKey: account.publicKey.toString(),
        message: "different server challenge",
        fullMessage,
        signature,
      }),
    ).resolves.toBe(false);
  });
});
