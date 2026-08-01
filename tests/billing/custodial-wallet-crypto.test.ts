import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decryptCustodialSigningMaterial,
  encryptCustodialSigningMaterial,
} from "../../src/server/billing/custodial-wallet-crypto";

describe("custodial deposit wallet encryption", () => {
  it("encrypts signing material with user and address bound as AAD", () => {
    const masterKey = randomBytes(32).toString("base64");
    const encrypted = encryptCustodialSigningMaterial({
      privateKey: "ed25519-priv-0xsecret",
      userId: "user-1",
      address: "0xdeposit",
      masterKey,
    });

    expect(encrypted).not.toContain("ed25519-priv-0xsecret");
    expect(
      decryptCustodialSigningMaterial({
        encrypted,
        userId: "user-1",
        address: "0xdeposit",
        masterKey,
      }),
    ).toBe("ed25519-priv-0xsecret");
  });

  it("fails closed with the wrong master key or wallet identity", () => {
    const masterKey = randomBytes(32).toString("base64");
    const encrypted = encryptCustodialSigningMaterial({
      privateKey: "ed25519-priv-0xsecret",
      userId: "user-1",
      address: "0xdeposit",
      masterKey,
    });

    expect(() =>
      decryptCustodialSigningMaterial({
        encrypted,
        userId: "user-2",
        address: "0xdeposit",
        masterKey,
      }),
    ).toThrow();
    expect(() =>
      decryptCustodialSigningMaterial({
        encrypted,
        userId: "user-1",
        address: "0xdeposit",
        masterKey: randomBytes(32).toString("base64"),
      }),
    ).toThrow();
  });
});
