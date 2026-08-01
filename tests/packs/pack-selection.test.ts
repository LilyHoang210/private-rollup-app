import { describe, expect, it } from "vitest";
import { selectPackCandidates } from "../../src/server/packs/pack-selection";

const now = new Date("2026-08-01T12:00:00.000Z");

describe("shared pack candidate selection", () => {
  it("groups only the same retention cohort and closes after maximum wait", () => {
    const selected = selectPackCandidates({
      now,
      candidates: [
        candidate("old-90", 90, 100, "2026-08-01T11:54:00.000Z"),
        candidate("new-90", 90, 200, "2026-08-01T11:59:00.000Z"),
        candidate("old-30", 30, 300, "2026-08-01T11:50:00.000Z"),
      ],
    });

    expect(selected.map((item) => item.id)).toEqual(["old-90", "new-90"]);
  });

  it("closes a dedicated upload alone and supports a user-forced shared cohort", () => {
    const candidates = [
      candidate("shared-a", 90, 100, "2026-08-01T11:59:00.000Z"),
      candidate("shared-b", 90, 200, "2026-08-01T11:59:30.000Z"),
      { ...candidate("dedicated", 90, 20_000_000, "2026-08-01T11:59:40.000Z"), dedicated: true },
    ];

    expect(
      selectPackCandidates({ now, candidates, forceBatchId: "shared-a" }).map(
        (item) => item.id,
      ),
    ).toEqual(["shared-a", "shared-b"]);
    expect(
      selectPackCandidates({ now, candidates, forceBatchId: "dedicated" }).map(
        (item) => item.id,
      ),
    ).toEqual(["dedicated"]);
  });
});

function candidate(
  id: string,
  retentionDays: 30 | 90 | 365,
  packBytes: number,
  createdAt: string,
) {
  return {
    id,
    retentionDays,
    packBytes,
    createdAt: new Date(createdAt),
    dedicated: false,
  };
}
