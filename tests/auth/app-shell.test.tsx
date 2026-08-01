// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../../src/components/app-shell/app-shell";

const walletState = vi.hoisted(() => ({
  current: {
    connected: true,
    isLoading: false,
    account: {
      address: { toString: () => "0x1234567890abcdef" },
    } as null | { address: { toString: () => string } },
  },
}));

vi.mock("@aptos-labs/wallet-adapter-react", () => ({
  useWallet: () => walletState.current,
}));

describe("app shell", () => {
  afterEach(() => {
    walletState.current.connected = true;
    walletState.current.isLoading = false;
    walletState.current.account = {
      address: { toString: () => "0x1234567890abcdef" },
    };
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
