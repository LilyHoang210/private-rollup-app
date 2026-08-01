import { describe, expect, it } from "vitest";
import {
  allocatePackCostByBytes,
  estimateReserveMicrocredits,
  formatCredits,
} from "../../src/domain/credits";

describe("credit accounting domain", () => {
  it("estimates a larger reserve for larger files and longer retention", () => {
    const smallThirty = estimateReserveMicrocredits({
      ciphertextBytes: 1_000,
      retentionDays: 30,
    });
    const largeThirty = estimateReserveMicrocredits({
      ciphertextBytes: 2_000,
      retentionDays: 30,
    });
    const largeYear = estimateReserveMicrocredits({
      ciphertextBytes: 2_000,
      retentionDays: 365,
    });

    expect(largeThirty).toBeGreaterThan(smallThirty);
    expect(largeYear).toBeGreaterThan(largeThirty);
  });

  it("allocates pack cost by encrypted bytes and preserves the exact total", () => {
    const allocations = allocatePackCostByBytes({
      totalCostMicrocredits: 1_000_000,
      members: [
        { memberId: "user-a", ciphertextBytes: 10 },
        { memberId: "user-b", ciphertextBytes: 40 },
        { memberId: "user-c", ciphertextBytes: 50 },
      ],
    });

    expect(allocations).toEqual([
      { memberId: "user-a", costMicrocredits: 100_000 },
      { memberId: "user-b", costMicrocredits: 400_000 },
      { memberId: "user-c", costMicrocredits: 500_000 },
    ]);
    expect(
      allocations.reduce((total, allocation) => total + allocation.costMicrocredits, 0),
    ).toBe(1_000_000);
  });

  it("allocates rounding remainder deterministically to the largest contributors", () => {
    const allocations = allocatePackCostByBytes({
      totalCostMicrocredits: 10,
      members: [
        { memberId: "small", ciphertextBytes: 1 },
        { memberId: "large", ciphertextBytes: 2 },
      ],
    });

    expect(allocations).toEqual([
      { memberId: "small", costMicrocredits: 3 },
      { memberId: "large", costMicrocredits: 7 },
    ]);
  });

  it("rejects zero-byte pack cost allocation", () => {
    expect(() =>
      allocatePackCostByBytes({
        totalCostMicrocredits: 100,
        members: [{ memberId: "empty", ciphertextBytes: 0 }],
      }),
    ).toThrow("Pack ciphertext bytes must be greater than zero");
  });

  it("formats integer microcredits as credits", () => {
    expect(formatCredits(1_234_567)).toBe("1.234567 credits");
  });
});
