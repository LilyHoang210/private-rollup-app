import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const uiRoots = ["src/app", "src/components", "src/features", "e2e"];
const prohibitedUiPhrases = [
  "Vao dashboard",
  "Ket noi",
  "Dang ket noi",
  "Da tao",
  "Khong tao",
  "chua ket noi",
  "ma hoa",
  "phuc hoi",
  "phu trach",
  "trinh duyet",
  "Nguong",
  "duoc gom",
  "cuc bo",
];

function sourceFiles(root: string): string[] {
  return execFileSync("rg", ["--files", root], {
    cwd: process.cwd(),
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((file) => /\.(ts|tsx)$/.test(file));
}

describe("English-only website UI", () => {
  it("does not ship Vietnamese UI copy in app, component, feature, or e2e sources", () => {
    const files = uiRoots.flatMap(sourceFiles);

    for (const file of files) {
      const content = readFileSync(path.join(process.cwd(), file), "utf8");

      for (const phrase of prohibitedUiPhrases) {
        expect(content, `${file} contains '${phrase}'`).not.toContain(phrase);
      }

      expect(content, `${file} contains non-ASCII UI copy`).not.toMatch(
        /[\u0080-\uffff]/,
      );
    }
  });
});
