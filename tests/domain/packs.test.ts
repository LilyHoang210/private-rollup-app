import { describe, expect, it } from "vitest";
import {
  getExpirationSeverity,
  isUploadTransitionAllowed,
} from "../../src/domain/packs";

describe("pack lifecycle rules", () => {
  const now = new Date("2026-07-31T00:00:00.000Z");

  it("maps expiration severity at normal, attention, urgent, and expired boundaries", () => {
    expect(getExpirationSeverity("2026-09-01T00:00:00.000Z", now)).toBe(
      "normal",
    );
    expect(getExpirationSeverity("2026-08-30T00:00:00.000Z", now)).toBe(
      "attention",
    );
    expect(getExpirationSeverity("2026-08-07T00:00:00.000Z", now)).toBe(
      "urgent",
    );
    expect(getExpirationSeverity("2026-07-31T00:00:00.000Z", now)).toBe(
      "expired",
    );
  });

  it("allows only forward upload lifecycle transitions plus retry from failed states", () => {
    expect(isUploadTransitionAllowed("encrypting", "staging")).toBe(true);
    expect(isUploadTransitionAllowed("verifying", "available")).toBe(true);
    expect(isUploadTransitionAllowed("failed", "retrying")).toBe(true);
    expect(isUploadTransitionAllowed("available", "packing")).toBe(false);
    expect(isUploadTransitionAllowed("waiting_for_pack", "available")).toBe(
      false,
    );
  });
});
