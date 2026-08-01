// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WalletConnectPanel } from "../../src/features/auth/wallet-connect-panel";

const createWalletChallenge = vi.fn();
const verifyWalletChallenge = vi.fn();
const connect = vi.fn();
const signMessage = vi.fn();
const walletState = vi.hoisted(() => ({
  current: {
    connected: false,
    isLoading: false,
    account: null as null | {
      address: { toString: () => string };
      publicKey: { toString: () => string };
    },
    connect: (...args: unknown[]) => Promise.resolve(connect(...args)),
    signMessage: (...args: unknown[]) => signMessage(...args),
    wallets: [] as Array<{ name: string; url?: string; icon?: string }>,
  },
}));

vi.mock("../../src/client/api/auth", () => ({
  createWalletChallenge: (...args: unknown[]) => createWalletChallenge(...args),
  verifyWalletChallenge: (...args: unknown[]) => verifyWalletChallenge(...args),
}));

vi.mock("@aptos-labs/wallet-adapter-react", () => ({
  useWallet: () => walletState.current,
}));

describe("wallet connect panel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    walletState.current.connected = false;
    walletState.current.isLoading = false;
    walletState.current.account = null;
    walletState.current.wallets = [];
    delete (window as unknown as { aptos?: unknown }).aptos;
  });

  it("explains what to do when no Aptos wallet extension is detected", async () => {
    render(<WalletConnectPanel />);

    await userEvent.click(screen.getByRole("button", { name: "Connect wallet" }));

    expect(
      await screen.findByRole("dialog", { name: "Choose a wallet" }),
    ).toBeVisible();
    expect(screen.getByText("No Aptos wallet extension detected.")).toBeVisible();
    expect(
      screen.getByText(/Install Petra, Martian, Pontem, Fewcha, or Rise/),
    ).toBeVisible();
  });

  it("opens one wallet picker modal and connects with an installed extension wallet", async () => {
    const deprecatedPetraConnect = vi.fn(() => {
      throw new Error("Direct usage of the PetraApiClient is deprecated.");
    });
    (window as unknown as { aptos?: unknown }).aptos = {
      connect: deprecatedPetraConnect,
    };
    walletState.current.wallets = [
      { name: "Petra" },
      { name: "OKX Wallet" },
      { name: "Continue with Google" },
      { name: "Continue with Apple" },
    ];
    connect.mockImplementation(async () => {
      walletState.current.connected = true;
      walletState.current.account = {
        address: { toString: () => "0xabc" },
        publicKey: { toString: () => "0xpublic" },
      };
    });
    signMessage.mockResolvedValue({
      signature: "0xsig",
      fullMessage: "APTOS\nchallenge",
    });
    createWalletChallenge.mockResolvedValue({
      id: "challenge-id",
      message: "challenge",
      expiresAt: "2026-08-01T00:05:00.000Z",
    });
    verifyWalletChallenge.mockResolvedValue({ chainId: "aptos-testnet" });

    const { rerender } = render(<WalletConnectPanel />);

    expect(screen.getByRole("button", { name: "Connect wallet" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Connect Petra" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Connect wallet" }));

    expect(
      await screen.findByRole("dialog", { name: "Choose a wallet" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Petra" })).toBeVisible();
    expect(screen.getByRole("button", { name: "OKX Wallet" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Continue with Google" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue with Apple" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Petra" }));
    rerender(<WalletConnectPanel />);

    expect(connect).toHaveBeenCalledWith("Petra");
    expect(deprecatedPetraConnect).not.toHaveBeenCalled();
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
