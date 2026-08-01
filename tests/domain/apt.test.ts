import { describe, expect, it } from "vitest";
import {
  allocatePackCostOctasByBytes,
  estimateReserveOctas,
  formatApt,
  parseAptToOctas,
} from "../../src/domain/apt";

describe("APT accounting domain", () => {
  it("estimates a larger reserve for larger files and longer retention", () => {
    const smallThirty = estimateReserveOctas({
      ciphertextBytes: 1_000,
      retentionDays: 30,
    });
    const largeThirty = estimateReserveOctas({
      ciphertextBytes: 2_000,
      retentionDays: 30,
    });
    const largeYear = estimateReserveOctas({
      ciphertextBytes: 2_000,
      retentionDays: 365,
    });

    expect(largeThirty).toBeGreaterThan(smallThirty);
    expect(largeYear).toBeGreaterThan(largeThirty);
  });

  it("allocates pack cost by encrypted bytes and preserves the exact total", () => {
    const allocations = allocatePackCostOctasByBytes({
      totalCostOctas: 1_000_000,
      members: [
        { memberId: "user-a", ciphertextBytes: 10 },
        { memberId: "user-b", ciphertextBytes: 40 },
        { memberId: "user-c", ciphertextBytes: 50 },
      ],
    });

    expect(allocations).toEqual([
      { memberId: "user-a", costOctas: 100_000 },
      { memberId: "user-b", costOctas: 400_000 },
      { memberId: "user-c", costOctas: 500_000 },
    ]);
    expect(
      allocations.reduce((total, allocation) => total + allocation.costOctas, 0),
    ).toBe(1_000_000);
  });

  it("allocates rounding remainder deterministically to the largest contributors", () => {
    const allocations = allocatePackCostOctasByBytes({
      totalCostOctas: 10,
      members: [
        { memberId: "small", ciphertextBytes: 1 },
        { memberId: "large", ciphertextBytes: 2 },
      ],
    });

    expect(allocations).toEqual([
      { memberId: "small", costOctas: 3 },
      { memberId: "large", costOctas: 7 },
    ]);
  });

  it("rejects zero-byte pack cost allocation", () => {
    expect(() =>
      allocatePackCostOctasByBytes({
        totalCostOctas: 100,
        members: [{ memberId: "empty", ciphertextBytes: 0 }],
      }),
    ).toThrow("Pack ciphertext bytes must be greater than zero");
  });

  it("formats integer octas as APT", () => {
    expect(formatApt(1_234_567)).toBe("0.01234567 APT");
  });

  it("parses an APT amount without floating-point rounding", () => {
    expect(parseAptToOctas("1.00000001")).toBe(100_000_001);
    expect(() => parseAptToOctas("0.000000001")).toThrow("at most 8 decimal places");
  });
});
