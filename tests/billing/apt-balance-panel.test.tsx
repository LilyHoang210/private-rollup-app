// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AptBalancePanel } from "../../src/features/billing/apt-balance-panel";

describe("APT balance panel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reloads the APT account after a wallet session is authenticated", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ error: "AUTH_REQUIRED" }, { status: 401 }))
      .mockResolvedValueOnce(
        Response.json({
          account: {
            userId: "wallet:user",
            balanceOctas: 100_000_000,
            reservedOctas: 0,
            availableOctas: 100_000_000,
            wallet: walletFixture(),
            ledger: [],
          },
        }),
      );

    render(<AptBalancePanel />);

    expect(await screen.findByText(/APT account request failed/)).toBeVisible();

    await act(async () => {
      window.dispatchEvent(new Event("private-rollup:session-authenticated"));
    });

    expect(await screen.findByText("Usable APT balance")).toBeVisible();
    expect(screen.getAllByText("1 APT").length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

function walletFixture() {
  return {
    address: `0x${"a".repeat(64)}`,
    network: "testnet",
    onChainBalanceOctas: 100_000_000,
  };
}
