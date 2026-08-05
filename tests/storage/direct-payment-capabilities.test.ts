import { describe, expect, it } from "vitest";
import {
  readShelbyDirectPaymentCapabilities,
  requireShelbyDirectPaymentCapabilities,
} from "@/server/shelby/direct-payment-capabilities";

describe("Shelby direct payment capability detection", () => {
  it("reports unsupported when Shelby Move payment functions are not configured", () => {
    const capabilities = readShelbyDirectPaymentCapabilities({
      SHELBY_NETWORK: "shelbynet",
    } as unknown as NodeJS.ProcessEnv);

    expect(capabilities).toEqual({
      supported: false,
      network: "shelbynet",
      aptRequired: true,
      reason:
        "Shelby direct contract payment requires SHELBY_DIRECT_PAYMENT_MODULE_ADDRESS, SHELBY_DIRECT_REGISTER_FUNCTION, SHELBY_DIRECT_PAY_FUNCTION, and SHELBY_STORAGE_COIN_TYPE.",
    });
  });

  it("returns configured direct payment interface when all required values are present", () => {
    const capabilities = readShelbyDirectPaymentCapabilities({
      SHELBY_NETWORK: "shelbynet",
      SHELBY_DIRECT_PAYMENT_MODULE_ADDRESS: "0x1",
      SHELBY_DIRECT_REGISTER_FUNCTION: "0x1::shelby::register_blob",
      SHELBY_DIRECT_PAY_FUNCTION: "0x1::shelby::pay_storage",
      SHELBY_STORAGE_COIN_TYPE: "0x1::aptos_coin::AptosCoin",
    } as unknown as NodeJS.ProcessEnv);

    expect(capabilities).toMatchObject({
      supported: true,
      network: "shelbynet",
      paymentModuleAddress: "0x1",
      registerFunction: "0x1::shelby::register_blob",
      payFunction: "0x1::shelby::pay_storage",
      storageCoinType: "0x1::aptos_coin::AptosCoin",
      aptRequired: true,
    });
  });

  it("throws a clear protocol blocker when strict direct payment is required but unavailable", () => {
    expect(() =>
      requireShelbyDirectPaymentCapabilities({
        SHELBY_NETWORK: "shelbynet",
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(
      "Shelby direct contract payment is not configured for this environment.",
    );
  });
});
