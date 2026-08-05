import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("pack close trigger", () => {
  it("tries automatic pack closing after upload completion without forcing early closure", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/api/uploads/[uploadId]/complete/route.ts"),
      "utf8",
    );

    expect(source).toContain('from "@/server/packs/worker"');
    expect(source).toContain("closeEligiblePack()");
    expect(source).not.toContain("forceBatchId");
  });
});
