import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Vercel cron configuration", () => {
  it("keeps the hosted cron compatible with Vercel Hobby limits", () => {
    const config = JSON.parse(
      readFileSync(join(process.cwd(), "vercel.json"), "utf8"),
    ) as { crons: Array<{ path: string; schedule: string }> };

    expect(config.crons).toContainEqual({
      path: "/api/cron/close-packs",
      schedule: "0 3 * * *",
    });
  });
});
