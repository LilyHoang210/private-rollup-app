import { chmod, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { importRecoveryKitKeyPair, type RecoveryKit } from "../src/client/crypto/hpke";
import { restoreFileFromReceipt } from "../src/client/recovery/restore-file";
import type { PrivateRollupReceipt } from "../src/domain/private-rollup-receipt";

const CONFIG_DIR = process.env.PRIVATE_ROLLUP_CONFIG_DIR || join(homedir(), ".private-rollup");
const SAVED_KIT = join(CONFIG_DIR, "recovery-kit.json");
const args = process.argv.slice(2);

try {
  if (args[0] === "recovery" && args[1] === "import") {
    await importRecoveryKit(args[2]);
  } else if (args[0] === "files" && args[1] === "list") {
    await listReceiptFiles(option("--receipts"));
  } else if (args[0] === "files" && args[1] === "pull") {
    await pullFile(args[2], option("--receipt"), option("--output"));
  } else if (args[0] === "--help" || args[0] === "-h" || args.length === 0) {
    printHelp();
  } else {
    throw new Error("Unknown command. Run with --help to see supported commands.");
  }
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : "Command failed"}`);
  process.exitCode = 1;
}

async function importRecoveryKit(path: string | undefined) {
  if (!path) throw new Error("Provide the path to recovery-kit.json");
  const kit = await readJson<RecoveryKit>(path);
  await importRecoveryKitKeyPair(kit);
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await writeFile(SAVED_KIT, `${JSON.stringify(kit, null, 2)}\n`, { mode: 0o600 });
  await chmod(SAVED_KIT, 0o600).catch(() => undefined);
  console.log(`Recovery kit validated and saved locally: ${SAVED_KIT}`);
  console.log(`Owner fingerprint: ${kit.ownerFingerprint}`);
}

async function listReceiptFiles(directory: string | undefined) {
  if (!directory) throw new Error("Provide --receipts <folder>");
  const absoluteDirectory = resolve(directory);
  const files = (await readdir(absoluteDirectory)).filter((file) => file.endsWith(".json"));
  let found = 0;
  for (const file of files) {
    try {
      const receipt = await readJson<PrivateRollupReceipt>(join(absoluteDirectory, file));
      if (receipt.format !== "private-rollup-receipt") continue;
      for (const item of receipt.items) {
        found += 1;
        console.log(
          [item.id, item.label, receipt.storage.blobName, basename(file)].join("\t"),
        );
      }
    } catch {
      // Ignore unrelated or malformed JSON files in the receipts folder.
    }
  }
  if (found === 0) console.log("No Private Rollup receipt files found.");
}

async function pullFile(
  fileId: string | undefined,
  receiptPath: string | undefined,
  outputDirectory: string | undefined,
) {
  if (!fileId) throw new Error("Provide the file ID shown by the list command");
  if (!receiptPath) throw new Error("Provide --receipt <receipt.json>");
  if (!outputDirectory) throw new Error("Provide --output <folder>");

  const [kit, receipt] = await Promise.all([
    readJson<RecoveryKit>(SAVED_KIT).catch(() => {
      throw new Error(
        "No imported recovery kit was found. Run the recovery import command first.",
      );
    }),
    readJson<PrivateRollupReceipt>(receiptPath),
  ]);
  const restored = await restoreFileFromReceipt({
    recoveryKit: kit,
    receipt,
    fileId,
  });
  const absoluteOutput = resolve(outputDirectory);
  await mkdir(absoluteOutput, { recursive: true, mode: 0o700 });
  const outputPath = join(absoluteOutput, restored.suggestedFileName);
  await writeFile(outputPath, restored.bytes, { mode: 0o600 });
  await chmod(outputPath, 0o600).catch(() => undefined);
  console.log(`Restored and verified: ${outputPath}`);
}

function option(name: string) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function readJson<T>(path: string) {
  return JSON.parse(await readFile(resolve(path), "utf8")) as T;
}

function printHelp() {
  console.log(`Private Rollup recovery CLI

Commands:
  node private-rollup-cli.mjs recovery import ./recovery-kit.json
  node private-rollup-cli.mjs files list --receipts ./receipts
  node private-rollup-cli.mjs files pull <file-id> --receipt ./receipt.json --output ./restored

Security:
  Decryption runs locally. The CLI verifies the Shelby pack and file hashes before
  decrypting. Never share recovery-kit.json.`);
}
