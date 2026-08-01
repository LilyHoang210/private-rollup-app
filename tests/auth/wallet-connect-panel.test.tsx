// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WalletConnectPanel } from "../../src/features/auth/wallet-connect-panel";

const createWalletChallenge = vi.fn();
const verifyWalletChallenge = vi.fn();

vi.mock("../../src/client/api/auth", () => ({
  createWalletChallenge: (...args: unknown[]) => createWalletChallenge(...args),
  verifyWalletChallenge: (...args: unknown[]) => verifyWalletChallenge(...args),
}));

describe("wallet connect panel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as unknown as { aptos?: unknown }).aptos;
    delete (window as unknown as { martian?: unknown }).martian;
  });

  it("explains what to do when no Aptos wallet extension is detected", async () => {
    render(<WalletConnectPanel />);

    expect(await screen.findByText("No Aptos wallet extension detected.")).toBeVisible();
    expect(
      screen.getByText(/Install Petra, Martian, Pontem, Fewcha, or Rise/),
    ).toBeVisible();
  });

  it("shows detected wallets and connects with the selected provider", async () => {
    const signMessage = vi.fn().mockResolvedValue({
      signature: "0xsig",
      fullMessage: "APTOS\nchallenge",
    });
    window.aptos = {
      connect: vi.fn().mockResolvedValue({
        address: "0xabc",
        publicKey: "0xpublic",
      }),
      signMessage,
    };
    window.martian = {
      connect: vi.fn(),
      signMessage: vi.fn(),
    };
    createWalletChallenge.mockResolvedValue({
      id: "challenge-id",
      message: "challenge",
      expiresAt: "2026-08-01T00:05:00.000Z",
    });
    verifyWalletChallenge.mockResolvedValue({ chainId: "aptos-testnet" });

    render(<WalletConnectPanel />);

    expect(await screen.findByRole("button", { name: "Connect Petra" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Connect Martian" })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Connect Petra" }));

    expect(createWalletChallenge).toHaveBeenCalledWith({
      walletAddress: "0xabc",
      domain: "localhost",
      uri: "http://localhost:3000",
      chainId: "aptos-testnet",
    });
    expect(verifyWalletChallenge).toHaveBeenCalledWith({
      challengeId: "challenge-id",
      walletAddress: "0xabc",
      publicKey: "0xpublic",
      domain: "localhost",
      signature: "0xsig",
      fullMessage: "APTOS\nchallenge",
    });
    expect(await screen.findByText(/Connected 0xabc on aptos-testnet/)).toBeVisible();
  });
});
