import { describe, expect, it, vi } from "vitest";
import {
  connectAptosWallet,
  detectAptosWallets,
  signAuthChallenge,
  type AptosWalletProvider,
} from "../../src/client/wallets/aptos-wallets";

describe("Aptos injected wallet detection", () => {
  it("detects installed Aptos wallet extensions in a stable display order", () => {
    const aptos = { connect: vi.fn() } as AptosWalletProvider;
    const martian = { connect: vi.fn() } as AptosWalletProvider;

    const wallets = detectAptosWallets({ aptos, martian });

    expect(wallets.map((wallet) => wallet.id)).toEqual(["petra", "martian"]);
    expect(wallets[0]).toMatchObject({
      name: "Petra",
      provider: aptos,
    });
  });

  it("ignores extension globals that do not expose a wallet-like provider", () => {
    const wallets = detectAptosWallets({
      aptos: null,
      pontem: { connect: "not-a-function" },
      fewcha: { signMessage: vi.fn() },
    });

    expect(wallets.map((wallet) => wallet.id)).toEqual(["fewcha"]);
  });

  it("connects and normalizes address and public key returned by a provider", async () => {
    const provider: AptosWalletProvider = {
      connect: vi.fn().mockResolvedValue({
        address: "0xabc",
        publicKey: "0xdef",
      }),
    };

    await expect(connectAptosWallet(provider)).resolves.toEqual({
      address: "0xabc",
      publicKey: "0xdef",
    });
  });

  it("falls back to provider.account when connect only approves the session", async () => {
    const provider: AptosWalletProvider = {
      connect: vi.fn().mockResolvedValue({}),
      account: vi.fn().mockResolvedValue({
        address: "0x123",
        publicKey: "0x456",
      }),
    };

    await expect(connectAptosWallet(provider)).resolves.toEqual({
      address: "0x123",
      publicKey: "0x456",
    });
  });

  it("asks the selected wallet to sign the server challenge with contextual flags and nonce", async () => {
    const signMessage = vi.fn().mockResolvedValue({
      signature: "0xsig",
      fullMessage: "APTOS\nchallenge",
    });
    const provider: AptosWalletProvider = { signMessage };
    const challenge = [
      "private-rollup.local wants you to sign in with your Aptos account:",
      "0xabc",
      "",
      "Authorize this session.",
      "",
      "Nonce: nonce-123",
    ].join("\n");

    await expect(signAuthChallenge(provider, challenge)).resolves.toEqual({
      signature: "0xsig",
      fullMessage: "APTOS\nchallenge",
    });
    expect(signMessage).toHaveBeenCalledWith({
      message: challenge,
      nonce: "nonce-123",
      address: true,
      application: true,
      chainId: true,
    });
  });
});
