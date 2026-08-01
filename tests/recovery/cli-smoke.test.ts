import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRecoveryKit } from "../../src/client/crypto/hpke";

const temporaryDirectories: string[] = [];
const cliPath = resolve("public/private-rollup-cli.mjs");

describe("standalone recovery CLI", () => {
  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        directory.startsWith(tmpdir())
          ? rm(directory, { recursive: true, force: true })
          : Promise.resolve(),
      ),
    );
  });

  it("prints runnable recovery commands", () => {
    const output = execFileSync(process.execPath, [cliPath, "--help"], {
      encoding: "utf8",
    });
    expect(output).toContain("recovery import");
    expect(output).toContain("files pull");
  });

  it("validates and stores a recovery kit in a private local config folder", async () => {
    const directory = await mkdtemp(join(tmpdir(), "private-rollup-cli-"));
    temporaryDirectories.push(directory);
    const configDirectory = join(directory, "config");
    const kitPath = join(directory, "recovery-kit.json");
    const kit = await createRecoveryKit();
    await writeFile(kitPath, JSON.stringify(kit), "utf8");

    const output = execFileSync(
      process.execPath,
      [cliPath, "recovery", "import", kitPath],
      {
        encoding: "utf8",
        env: { ...process.env, PRIVATE_ROLLUP_CONFIG_DIR: configDirectory },
      },
    );

    expect(output).toContain(kit.ownerFingerprint);
    await expect(readFile(join(configDirectory, "recovery-kit.json"), "utf8"))
      .resolves.toContain(kit.privateKey);
  });
});
