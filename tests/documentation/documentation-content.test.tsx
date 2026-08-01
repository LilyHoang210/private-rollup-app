import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("user-facing guidance content", () => {
  it("explains recovery kit, receipts, file id placeholders, and security behavior", () => {
    const documentation = readFileSync(
      path.join(process.cwd(), "src/app/app/documentation/page.tsx"),
      "utf8",
    );
    const recovery = readFileSync(
      path.join(process.cwd(), "src/app/app/recovery/page.tsx"),
      "utf8",
    );

    const combined = `${documentation}\n${recovery}`;
    expect(combined).toContain("recovery-kit.json");
    expect(combined).toContain("receipt.json");
    expect(combined).toContain("<file-id>");
    expect(combined).toContain("Do not paste private keys");
    expect(combined).toContain("Copy");
    expect(combined).toContain("What this does");
    expect(combined).toContain("How to use it");
    expect(combined).toContain("Security checklist");
    expect(combined).toContain("Petra");
    expect(combined).toContain("Martian");
    expect(combined).toContain("sign a login challenge");
  });
});
