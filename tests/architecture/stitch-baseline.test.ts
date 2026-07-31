import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const workspaceRoot = path.resolve(projectRoot, "..");
const screenMapPath = path.join(projectRoot, "docs", "STITCH_SCREEN_MAP.md");

const expectedSources = [
  "stitch_file_driven_design_system/stitch_file_driven_design_system/landing_page_private_rollup/code.html",
  "stitch_file_driven_design_system/stitch_file_driven_design_system/landing_page_private_rollup/screen.png",
  "stitch_file_driven_design_system/stitch_file_driven_design_system/dashboard_private_rollup/code.html",
  "stitch_file_driven_design_system/stitch_file_driven_design_system/dashboard_private_rollup/screen.png",
  "stitch_file_driven_design_system/stitch_file_driven_design_system/upload_private_rollup/code.html",
  "stitch_file_driven_design_system/stitch_file_driven_design_system/upload_private_rollup/screen.png",
  "stitch_file_driven_design_system/stitch_file_driven_design_system/chi_ti_t_pack_private_rollup/code.html",
  "stitch_file_driven_design_system/stitch_file_driven_design_system/chi_ti_t_pack_private_rollup/screen.png",
  "stitch_file_driven_design_system/stitch_file_driven_design_system/ph_c_h_i_private_rollup/code.html",
  "stitch_file_driven_design_system/stitch_file_driven_design_system/ph_c_h_i_private_rollup/screen.png",
  "stitch_file_driven_design_system/stitch_file_driven_design_system/private_rollup/DESIGN.md",
] as const;

function sha256(relativePath: string) {
  const buffer = readFileSync(path.join(workspaceRoot, relativePath));
  return createHash("sha256").update(buffer).digest("hex");
}

function parseHashManifest(markdown: string) {
  const hashes = new Map<string, string>();

  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^\|\s*`([^`]+)`\s*\|\s*`([a-f0-9]{64})`\s*\|$/);
    if (match) {
      hashes.set(match[1], match[2]);
    }
  }

  return hashes;
}

describe("Stitch visual baseline", () => {
  it("locks every approved Stitch source file to the documented sha256 hash", () => {
    const manifest = parseHashManifest(readFileSync(screenMapPath, "utf8"));

    expect([...manifest.keys()].sort()).toEqual([...expectedSources].sort());

    for (const sourcePath of expectedSources) {
      expect(manifest.get(sourcePath)).toBe(sha256(sourcePath));
    }
  });
});
