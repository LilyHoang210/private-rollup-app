import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  parseSessionToken,
} from "../../src/server/auth/session";

describe("wallet scoped session token", () => {
  it("round-trips wallet identity and rejects tampering", () => {
    const token = createSessionToken({
      walletAddress: "0x1234",
      walletAddressHash: "a".repeat(64),
      chainId: "aptos-shelbynet",
      maxAgeSeconds: 60,
      now: new Date("2026-08-01T00:00:00.000Z"),
      secret: "test-secret",
    });

    expect(
      parseSessionToken(token, {
        now: new Date("2026-08-01T00:00:30.000Z"),
        secret: "test-secret",
      }),
    ).toMatchObject({
      walletAddress: "0x1234",
      walletAddressHash: "a".repeat(64),
      chainId: "aptos-shelbynet",
    });
    const [payload, signature] = token.split(".");
    const tamperedSignature = `${signature.startsWith("a") ? "b" : "a"}${signature.slice(1)}`;

    expect(
      parseSessionToken(`${payload}.${tamperedSignature}`, {
        now: new Date("2026-08-01T00:00:30.000Z"),
        secret: "test-secret",
      }),
    ).toBeNull();
    expect(
      parseSessionToken(token, {
        now: new Date("2026-08-01T00:02:00.000Z"),
        secret: "test-secret",
      }),
    ).toBeNull();
  });
});
