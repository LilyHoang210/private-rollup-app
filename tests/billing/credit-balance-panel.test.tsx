// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreditBalancePanel } from "../../src/features/billing/credit-balance-panel";

describe("credit balance panel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reloads credits after a wallet session is authenticated", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ error: "AUTH_REQUIRED" }, { status: 401 }))
      .mockResolvedValueOnce(
        Response.json({
          account: {
            userId: "wallet:user",
            balanceMicrocredits: 100_000_000,
            reservedMicrocredits: 0,
            availableMicrocredits: 100_000_000,
            ledger: [],
          },
        }),
      );

    render(<CreditBalancePanel />);

    expect(await screen.findByText(/Connect wallet to load credits/)).toBeVisible();

    await act(async () => {
      window.dispatchEvent(new Event("private-rollup:session-authenticated"));
    });

    expect(await screen.findByText("Total balance")).toBeVisible();
    expect(screen.getAllByText("100.000000 credits").length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
