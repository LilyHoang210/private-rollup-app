// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../../src/components/app-shell/app-shell";

const createWalletChallenge = vi.fn();
const verifyWalletChallenge = vi.fn();
const getAptBalance = vi.fn();
const connect = vi.fn();
const disconnect = vi.fn();
const signMessage = vi.fn();
const walletState = vi.hoisted(() => ({
  current: {
    connected: true,
    isLoading: false,
    account: {
      address: { toString: () => "0x1234567890abcdef" },
    } as null | {
      address: { toString: () => string };
      publicKey?: { toString: () => string };
    },
    connect: (...args: unknown[]) => Promise.resolve(connect(...args)),
    disconnect: (...args: unknown[]) => Promise.resolve(disconnect(...args)),
    signMessage: (...args: unknown[]) => signMessage(...args),
    wallet: { name: "Petra" } as null | { name: string },
    wallets: [] as Array<{ name: string }>,
  },
}));

vi.mock("../../src/client/api/auth", () => ({
  createWalletChallenge: (...args: unknown[]) => createWalletChallenge(...args),
  verifyWalletChallenge: (...args: unknown[]) => verifyWalletChallenge(...args),
}));

vi.mock("../../src/client/aptos/balance", () => ({
  getAptBalance: (...args: unknown[]) => getAptBalance(...args),
}));

vi.mock("@aptos-labs/wallet-adapter-react", () => ({
  useWallet: () => walletState.current,
}));

describe("app shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    walletState.current.connected = true;
    walletState.current.isLoading = false;
    walletState.current.account = {
      address: { toString: () => "0x1234567890abcdef" },
      publicKey: { toString: () => "0xpublic" },
    };
    walletState.current.wallet = { name: "Petra" };
    walletState.current.wallets = [];
    getAptBalance.mockResolvedValue("1.23456789 APT");
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders authenticated navigation with stable action ids", () => {
    render(
      <AppShell>
        <h1>Dashboard</h1>
      </AppShell>,
    );

    expect(
      screen
        .getAllByRole("link", { name: "Dashboard" })
        .every((link) => link.getAttribute("data-action") === "nav.dashboard"),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: "File Upload" })
        .every((link) => link.getAttribute("data-action") === "nav.upload"),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: "Blob Packs" })
        .every((link) => link.getAttribute("data-action") === "nav.packs"),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: "Recovery" })
        .every((link) => link.getAttribute("data-action") === "nav.recovery"),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: "Setup Wizard" })
        .every((link) => link.getAttribute("data-action") === "nav.setup"),
    ).toBe(true);
    expect(screen.getByRole("main")).toContainElement(
      screen.getByRole("heading", { name: "Dashboard" }),
    );
    expect(screen.queryByText("0x12aF...9c4B")).not.toBeInTheDocument();
    expect(screen.getByText("0x1234...cdef")).toBeVisible();
  });

  it("falls back gracefully while the wallet adapter restores account state", () => {
    walletState.current.connected = true;
    walletState.current.account = null;

    render(
      <AppShell>
        <h1>Dashboard</h1>
      </AppShell>,
    );

    expect(screen.getByText("Wallet connected")).toBeVisible();
  });

  it("opens connected wallet details with balance and logout", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    render(
      <AppShell>
        <h1>Dashboard</h1>
      </AppShell>,
    );

    await userEvent.click(screen.getByRole("button", { name: /Connected wallet/ }));

    expect(await screen.findByRole("dialog", { name: "Wallet details" })).toBeVisible();
    expect(screen.getByText("Petra")).toBeVisible();
    expect(screen.getByText("0x1234567890abcdef")).toBeVisible();
    expect(await screen.findByText("1.23456789 APT")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(disconnect).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
  });

  it("lets disconnected users connect from the header wallet button", async () => {
    walletState.current.connected = false;
    walletState.current.account = null;
    walletState.current.wallet = null;
    walletState.current.wallets = [
      { name: "Petra" },
      { name: "Continue with Google" },
    ];
    connect.mockImplementation(async () => {
      walletState.current.connected = true;
      walletState.current.account = {
        address: { toString: () => "0xabc" },
        publicKey: { toString: () => "0xpublic" },
      };
      walletState.current.wallet = { name: "Petra" };
    });

    const { rerender } = render(
      <AppShell>
        <h1>Dashboard</h1>
      </AppShell>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Connect wallet" }));

    expect(await screen.findByRole("dialog", { name: "Choose a wallet" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Petra" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Continue with Google" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Petra" }));
    rerender(
      <AppShell>
        <h1>Dashboard</h1>
      </AppShell>,
    );

    expect(connect).toHaveBeenCalledWith("Petra");
    expect(verifyWalletChallenge).toHaveBeenCalledWith({
      challengeId: "challenge-id",
      walletAddress: "0xabc",
      publicKey: "0xpublic",
      domain: "localhost",
      signature: "0xsig",
      fullMessage: "APTOS\nchallenge",
    });
    expect(await screen.findByText("0xabc")).toBeVisible();
  });

  it("routes secondary navigation to dedicated pages", () => {
    render(
      <AppShell>
        <h1>Recovery</h1>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: "Support" })).toHaveAttribute(
      "href",
      "/app/support",
    );
    expect(screen.getByRole("link", { name: "Documentation" })).toHaveAttribute(
      "href",
      "/app/documentation",
    );
  });
});
