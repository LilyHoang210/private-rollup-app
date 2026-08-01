import { describe, expect, it } from "vitest";
import {
  addressFromPrivateKey,
  generateCustodialWallet,
} from "../../src/server/billing/aptos-wallet";

describe("custodial Aptos wallet", () => {
  it("generates signing material that reconstructs the same address", () => {
    const wallet = generateCustodialWallet();

    expect(wallet.address).toMatch(/^0x[a-f0-9]{64}$/);
    expect(wallet.privateKey).not.toContain(wallet.address.slice(2));
    expect(addressFromPrivateKey(wallet.privateKey)).toBe(wallet.address);
  });
});
