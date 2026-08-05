// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AptBalancePanel,
  userFacingErrorMessage,
} from "../../src/features/billing/apt-balance-panel";

const { signAndSubmitTransactionMock, walletHookMock } = vi.hoisted(() => ({
  signAndSubmitTransactionMock: vi.fn(),
  walletHookMock: vi.fn(),
}));

vi.mock("@aptos-labs/wallet-adapter-react", () => ({
  useWallet: () => walletHookMock(),
}));

describe("APT balance panel", () => {
  beforeEach(() => {
    walletHookMock.mockReturnValue({
      connected: false,
      signAndSubmitTransaction: signAndSubmitTransactionMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("reloads the APT account after a wallet session is authenticated", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ error: "AUTH_REQUIRED" }, { status: 401 }))
      .mockResolvedValueOnce(
        Response.json({
          contractAddress: "0x42",
          reservedOctas: 0,
          refundableOctas: 100_000_000,
          reservations: [],
        }),
      );

    render(<AptBalancePanel />);

    expect(await screen.findByText(/Payment Vault status request failed/)).toBeVisible();

    await act(async () => {
      window.dispatchEvent(new Event("private-rollup:session-authenticated"));
    });

    expect(await screen.findByText("Payment Vault contract")).toBeVisible();
    expect(screen.getAllByText("1 APT").length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows useful wallet errors when adapters reject with non-Error values", () => {
    expect(userFacingErrorMessage("User rejected")).toBe("User rejected");
    expect(userFacingErrorMessage({ message: "Wallet is locked" })).toBe("Wallet is locked");
    expect(userFacingErrorMessage(null, "Fallback")).toBe("Fallback");
  });

  it("shows Payment Vault balances and signs refund withdrawals directly from the connected wallet", async () => {
    walletHookMock.mockReturnValue({
      connected: true,
      signAndSubmitTransaction: signAndSubmitTransactionMock.mockResolvedValue({
        hash: `0x${"1".repeat(64)}`,
      }),
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json({
        contractAddress: "0x42",
        reservedOctas: 252_767,
        refundableOctas: 1_000_000,
        reservations: [
          {
            requestId: "vault_req_1",
            status: "settled",
            totalLockedOctas: 252_767,
            refundableOctas: 1_000_000,
            deadlineAt: "2027-01-15T08:00:00.000Z",
          },
        ],
      }),
    );

    render(<AptBalancePanel />);

    expect(await screen.findByText("Payment Vault contract")).toBeVisible();
    expect(screen.getByText("Reserved for pending uploads")).toBeVisible();
    expect(screen.getByText("0.00252767 APT")).toBeVisible();
    expect(screen.getByText("Refundable")).toBeVisible();
    expect(screen.getAllByText("0.01 APT").length).toBeGreaterThan(0);
    expect(screen.getByText("vault_req_1")).toBeVisible();
    expect(screen.queryByText(/service wallet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/credit/i)).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("APT amount to withdraw from Payment Vault"), "0.01");
    await userEvent.click(screen.getByRole("button", { name: "Withdraw refund" }));

    expect(signAndSubmitTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          function: "0x42::payment_vault::withdraw_refund",
          functionArguments: [1_000_000],
        }),
      }),
    );
    expect(await screen.findByText("Refund withdrawal submitted: 0x11111111...11111111")).toBeVisible();
  });

  it("blocks refund withdrawal until a connected wallet is available", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json({
        contractAddress: "0x42",
        reservedOctas: 0,
        refundableOctas: 1_000_000,
        reservations: [],
      }),
    );

    render(<AptBalancePanel />);

    await screen.findByText("Payment Vault contract");
    await userEvent.type(screen.getByLabelText("APT amount to withdraw from Payment Vault"), "0.01");

    expect(screen.getByRole("button", { name: "Withdraw refund" })).toBeDisabled();
  });
});
