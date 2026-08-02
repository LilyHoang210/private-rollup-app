// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AptBalancePanel,
  buildDepositTransaction,
  userFacingErrorMessage,
  withWalletResponseTimeout,
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

  it("builds an explicit Aptos transfer payload for wallet-standard deposits", () => {
    const transaction = buildDepositTransaction({
      recipientAddress: walletFixture().address,
      amountOctas: 1_000_000,
    });

    expect(transaction).toMatchObject({
      data: {
        function: "0x1::coin::transfer",
        typeArguments: ["0x1::aptos_coin::AptosCoin"],
        functionArguments: [walletFixture().address, 1_000_000],
      },
    });
    expect(transaction.transactionSubmitter).toBeUndefined();
  });

  it("times out a wallet deposit when the wallet closes without returning a hash", async () => {
    await expect(
      withWalletResponseTimeout(new Promise(() => undefined), 10),
    ).rejects.toThrow("Wallet did not return a transaction hash");
  });

  it("shows useful wallet errors when adapters reject with non-Error values", () => {
    expect(userFacingErrorMessage("User rejected")).toBe("User rejected");
    expect(userFacingErrorMessage({ message: "Wallet is locked" })).toBe("Wallet is locked");
    expect(userFacingErrorMessage(null, "Fallback")).toBe("Fallback");
  });

  it("submits a wallet transfer and syncs the confirmed APT balance", async () => {
    walletHookMock.mockReturnValue({
      connected: true,
      signAndSubmitTransaction: signAndSubmitTransactionMock.mockResolvedValue({
        hash: `0x${"1".repeat(64)}`,
      }),
    });
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          account: {
            userId: "wallet:user",
            balanceOctas: 0,
            reservedOctas: 0,
            availableOctas: 0,
            wallet: walletFixture(),
            ledger: [],
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          account: {
            userId: "wallet:user",
            balanceOctas: 1_000_000,
            reservedOctas: 0,
            availableOctas: 1_000_000,
            wallet: { ...walletFixture(), onChainBalanceOctas: 1_000_000 },
            ledger: [],
          },
        }),
      );

    render(<AptBalancePanel />);

    expect((await screen.findAllByText("0 APT")).length).toBeGreaterThan(0);
    await userEvent.type(screen.getByLabelText("APT amount to deposit"), "0.01");
    await userEvent.click(screen.getByRole("button", { name: "Deposit APT" }));

    expect(signAndSubmitTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          function: "0x1::coin::transfer",
          typeArguments: ["0x1::aptos_coin::AptosCoin"],
          functionArguments: [walletFixture().address, 1_000_000],
        }),
      }),
    );
    expect(await screen.findByText("Deposit confirmed: 0x11111111...11111111")).toBeVisible();
    expect(screen.getAllByText("0.01 APT").length).toBeGreaterThan(0);
  });
});

function walletFixture() {
  return {
    address: `0x${"a".repeat(64)}`,
    network: "testnet",
    onChainBalanceOctas: 100_000_000,
  };
}
