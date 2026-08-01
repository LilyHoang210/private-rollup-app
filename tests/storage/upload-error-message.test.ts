import { describe, expect, it } from "vitest";
import { friendlyShelbyError } from "../../src/app/api/storage/upload/route";

describe("Shelby upload error messages", () => {
  it("turns node gas errors into a safe user-facing message", () => {
    expect(
      friendlyShelbyError(
        new Error('Fullnode failed: {"error_code":"INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE"}'),
      ),
    ).toBe(
      "The storage service needs more Shelbynet APT for gas. No user APT was charged; please try again after the operator refills it.",
    );
  });

  it("does not leak unknown upstream internals", () => {
    expect(friendlyShelbyError(new Error("secret upstream stack details"))).toBe(
      "Shelby could not complete and verify this upload. No user APT was charged; please try again.",
    );
  });
});
