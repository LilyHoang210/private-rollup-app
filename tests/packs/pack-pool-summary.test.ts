import { describe, expect, it } from "vitest";
import { summarizePackPools } from "../../src/server/packs/pool-summary";

describe("pack pool summary", () => {
  it("shows shared pool progress and the next close trigger by retention cohort", () => {
    const pools = summarizePackPools({
      now: new Date("2026-08-01T12:03:00.000Z"),
      batches: [
        batch("old-90", 90, 1024, "2026-08-01T12:00:00.000Z"),
        batch("new-90", 90, 2048, "2026-08-01T12:02:00.000Z"),
        batch("dedicated-90", 90, 12 * 1024 * 1024, "2026-08-01T12:01:00.000Z", true),
        batch("available-30", 30, 1024, "2026-08-01T12:00:00.000Z", false, "available"),
      ],
    });

    expect(pools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          retentionDays: 90,
          waitingBatchCount: 2,
          queuedBytes: 3072,
          targetBytes: 8 * 1024 * 1024,
          maxBytes: 50 * 1024 * 1024,
          maxWaitSeconds: 300,
          oldestBatchAgeSeconds: 180,
          timeUntilForcedCloseSeconds: 120,
          paymentStatus: "collecting",
          secondsRemaining: 120,
          progressRatio: expect.closeTo(3072 / (8 * 1024 * 1024), 6),
          trigger: "waiting",
          nextTrigger: "wait_time",
          oldestBatchId: "old-90",
          userBatchIds: ["old-90", "new-90"],
        }),
      ]),
    );
  });

  it("counts retrying shared batches as visible pool participants", () => {
    const pools = summarizePackPools({
      now: new Date("2026-08-01T12:01:00.000Z"),
      batches: [
        batch("retry-90", 90, 4096, "2026-08-01T12:00:00.000Z", false, "retrying"),
      ],
    });

    expect(pools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          retentionDays: 90,
          waitingBatchCount: 1,
          queuedBytes: 4096,
          oldestBatchId: "retry-90",
          userBatchIds: ["retry-90"],
        }),
      ]),
    );
  });
});

function batch(
  id: string,
  retentionDays: 30 | 90 | 365,
  totalCiphertextSizeBytes: number,
  createdAt: string,
  dedicated = false,
  status = "waiting_for_pack",
) {
  return {
    id,
    retentionDays,
    totalCiphertextSizeBytes,
    status,
    createdAt,
    items: [
      {
        packStrategy: dedicated ? "dedicated_blob" : "shared_pack",
      },
    ],
  };
}
