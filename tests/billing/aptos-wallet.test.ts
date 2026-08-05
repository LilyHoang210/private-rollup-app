import { describe, expect, it, vi } from "vitest";
import {
  addressFromPrivateKey,
  generateCustodialWallet,
  submitCustodialAptWithdrawal,
} from "../../src/server/billing/aptos-wallet";

describe("custodial Aptos wallet", () => {
  it("generates signing material that reconstructs the same address", () => {
    const wallet = generateCustodialWallet();

    expect(wallet.address).toMatch(/^0x[a-f0-9]{64}$/);
    expect(wallet.privateKey).not.toContain(wallet.address.slice(2));
    expect(addressFromPrivateKey(wallet.privateKey)).toBe(wallet.address);
  });

  it("submits withdrawals from the custodial wallet without a separate fee payer", async () => {
    const sender = { accountAddress: "0xcustodial" };
    const buildSimple = vi.fn().mockResolvedValue("raw-transaction");
    const signAndSubmitTransaction = vi.fn().mockResolvedValue({ hash: "0xwithdrawal" });
    const waitForTransaction = vi.fn().mockResolvedValue({
      success: true,
      gas_used: "5414",
      gas_unit_price: "100",
    });

    const result = await submitCustodialAptWithdrawal(
      {
        custodialPrivateKey: "0xprivate",
        destination: "0xdestination",
        amountOctas: 123_000,
      },
      {
        accountFromPrivateKey: () => sender as never,
        aptosClient: {
          transaction: { build: { simple: buildSimple } },
          signAndSubmitTransaction,
          waitForTransaction,
        } as never,
      },
    );

    expect(buildSimple).toHaveBeenCalledWith({
      sender: "0xcustodial",
      data: {
        function: "0x1::aptos_account::transfer",
        functionArguments: ["0xdestination", 123_000],
      },
      options: {
        gasUnitPrice: 100,
        maxGasAmount: 6_000,
      },
    });
    expect(signAndSubmitTransaction).toHaveBeenCalledWith({
      signer: sender,
      transaction: "raw-transaction",
    });
    expect(signAndSubmitTransaction).not.toHaveBeenCalledWith(
      expect.objectContaining({ feePayer: expect.anything() }),
    );
    expect(result).toEqual({
      transactionHash: "0xwithdrawal",
      success: true,
      gasFeeOctas: 541_400,
    });
  });
});
