"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FolderUp, PackageCheck, ShieldCheck, UploadCloud } from "lucide-react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { formatApt, getAptAccount, syncAptDeposits } from "@/client/api/apt-account";
import { depositToServiceWallet } from "@/client/aptos/deposit";
import { estimateReserveOctas } from "@/domain/apt";
import type { FileCategory, RetentionCohort } from "@/domain/files";
import { PACK_STRATEGY_THRESHOLD_BYTES } from "@/domain/files";
import {
  completeUploadBatch,
  closePackNow,
  createUploadBatch,
  getUploadBatchById,
  stageEncryptedPack,
  type UploadApiBatchResponse,
  type UploadApiItemInput,
} from "@/client/api/uploads";
import { rememberLocalUploadBatch } from "@/client/uploads/local-upload-cache";
import {
  base64ToBytes,
  buildEncryptedPack,
} from "@/client/uploads/encrypted-pack";
import { encryptChunkedPayload } from "@/client/crypto/chunk-encrypt";
import {
  importVaultPublicKey,
  wrapDekForVault,
  type WrappedDek,
} from "@/client/crypto/hpke";
import { readLocalVaultPublicMaterial } from "@/client/vault/local-vault";
import { downloadBatchReceipt } from "@/client/recovery/receipt-download";

const CHUNK_SIZE_BYTES = 1024 * 1024;
const categoryOptions: FileCategory[] = [
  "document",
  "image",
  "video",
  "audio",
  "dataset",
  "archive",
  "code",
  "other",
];

type StorageStatus =
  | { kind: "loading" }
  | {
      kind: "ready";
      ready: boolean;
      driver: string;
      network: string;
      missing: string[];
      mode: string;
    }
  | { kind: "failed" };

type AptState =
  | { kind: "loading" }
  | {
      kind: "ready";
      balanceOctas: number;
      reservedOctas: number;
      availableOctas: number;
      walletAddress: string;
    }
  | { kind: "failed" };

export function UploadPanel() {
  const { connected, signAndSubmitTransaction } = useWallet();
  const [files, setFiles] = useState<File[]>([]);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<FileCategory>("document");
  const [retentionDays, setRetentionDays] = useState<RetentionCohort>(90);
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "encrypting" }
    | { kind: "failed"; message: string }
    | { kind: "ready"; batch: UploadApiBatchResponse }
  >({ kind: "idle" });
  const [storageStatus, setStorageStatus] = useState<StorageStatus>({
    kind: "loading",
  });
  const [aptState, setAptState] = useState<AptState>({ kind: "loading" });
  const [depositState, setDepositState] = useState<
    | { kind: "idle" }
    | { kind: "depositing" }
    | { kind: "failed"; message: string }
    | { kind: "confirmed"; message: string }
  >({ kind: "idle" });
  const [isClosingPack, setIsClosingPack] = useState(false);
  const [vaultMaterial] = useState(() => readLocalVaultPublicMaterial());

  const selectedSize = useMemo(
    () => files.reduce((total, file) => total + file.size, 0),
    [files],
  );
  const estimatedReserveOctas = useMemo(() => {
    if (files.length === 0) {
      return 0;
    }

    return estimateReserveOctas({
      ciphertextBytes: selectedSize,
      retentionDays,
    });
  }, [files.length, retentionDays, selectedSize]);
  const hasDedicatedFile = useMemo(
    () => files.some((file) => file.size >= PACK_STRATEGY_THRESHOLD_BYTES),
    [files],
  );
  const packMode = hasDedicatedFile ? "Dedicated Blob" : "Shared Pack";
  const insufficientApt =
    files.length > 0 &&
    aptState.kind === "ready" &&
    aptState.availableOctas < estimatedReserveOctas;
  const missingAptOctas =
    insufficientApt && aptState.kind === "ready"
      ? estimatedReserveOctas - aptState.availableOctas
      : 0;

  useEffect(() => {
    let active = true;

    void fetch("/api/storage/status")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Storage status request failed: ${response.status}`);
        }

        return response.json() as Promise<{
          ready: boolean;
          driver: string;
          network: string;
          missing: string[];
          mode: string;
        }>;
      })
      .then((status) => {
        if (active) {
          setStorageStatus({ kind: "ready", ...status });
        }
      })
      .catch(() => {
        if (active) {
          setStorageStatus({ kind: "failed" });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    void getAptAccount()
      .then(({ account }) => {
        if (active) {
          setAptState({
            kind: "ready",
            balanceOctas: account.balanceOctas,
            reservedOctas: account.reservedOctas,
            availableOctas: account.availableOctas,
            walletAddress: account.wallet.address,
          });
        }
      })
      .catch(() => {
        if (active) {
          setAptState({ kind: "failed" });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function submitUpload() {
    if (files.length === 0) {
      setState({ kind: "failed", message: "Select at least one file first." });
      return;
    }
    if (!vaultMaterial) {
      setState({
        kind: "failed",
        message: "Initialize your vault and save recovery-kit.json before uploading.",
      });
      return;
    }
    if (storageStatus.kind !== "ready" || !storageStatus.ready) {
      setState({
        kind: "failed",
        message: "Shelby storage is not ready. No APT has been charged.",
      });
      return;
    }
    if (insufficientApt) {
      setState({
        kind: "failed",
        message: insufficientAptMessage({
          reserveOctas: estimatedReserveOctas,
          availableOctas: aptState.availableOctas,
          missingOctas: missingAptOctas,
        }),
      });
      return;
    }

    setState({ kind: "encrypting" });

    try {
      const uploadItems = await prepareEncryptedUploadItems({
        files,
        label: label.trim() || "Private upload",
        category,
        vaultPublicKey: vaultMaterial.publicKey,
      });
      const encryptedPack = await buildEncryptedPack(
        uploadItems.map((item) => ({
          localId: item.localId,
          ciphertext: item.ciphertext,
          ciphertextSha256: item.ciphertextSha256,
          encryptedManifest: item.encryptedManifest,
          wrappedDek: item.wrappedDek,
          aad: item.aad,
        })),
      );
      const apiItems = uploadItems.map(toApiUploadItem);
      const created = await createUploadBatch({
        idempotencyKey: globalThis.crypto.randomUUID(),
        retentionDays,
        items: apiItems,
      });
      const staged = await stageEncryptedPack({
        batchId: created.id,
        bytes: encryptedPack.bytes,
      });
      const uploaded = await completeUploadBatch(created.id, {
        stagingObjectKey: staged.pathname,
        stagingObjectUrl: staged.url,
        packSha256: encryptedPack.sha256,
        packSizeBytes: encryptedPack.bytes.byteLength,
      });
      const localItemById = new Map(
        uploadItems.map((item) => [
          item.localId,
          { label: item.label, category: item.category, mimeType: item.mimeType },
        ]),
      );
      const completed: UploadApiBatchResponse = {
        ...uploaded,
        items: uploaded.items.map((item) => ({
          ...item,
          ...localItemById.get(item.localId),
        })),
      };

      rememberLocalUploadBatch(completed);
      setState({ kind: "ready", batch: completed });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setState({
        kind: "failed",
        message:
          message.includes("Insufficient available APT")
            ? insufficientAptMessage({
                reserveOctas: estimatedReserveOctas,
                availableOctas:
                  aptState.kind === "ready" ? aptState.availableOctas : 0,
                missingOctas:
                  aptState.kind === "ready"
                    ? Math.max(0, estimatedReserveOctas - aptState.availableOctas)
                    : estimatedReserveOctas,
              })
            : message,
      });
    }
  }

  async function depositMissingApt() {
    if (aptState.kind !== "ready" || missingAptOctas <= 0) return;
    if (!connected) {
      setDepositState({
        kind: "failed",
        message: "Connect your Aptos wallet before depositing to the service wallet.",
      });
      return;
    }

    setDepositState({ kind: "depositing" });
    try {
      const { account, transactionHash } = await depositToServiceWallet({
        amountOctas: missingAptOctas,
        recipientAddress: aptState.walletAddress,
        previousBalanceOctas: aptState.balanceOctas,
        signAndSubmitTransaction,
        syncDeposits: syncAptDeposits,
      });
      setAptState({
        kind: "ready",
        balanceOctas: account.balanceOctas,
        reservedOctas: account.reservedOctas,
        availableOctas: account.availableOctas,
        walletAddress: account.wallet.address,
      });
      setDepositState({
        kind: "confirmed",
        message: `Deposit confirmed: ${shortAddress(transactionHash)}. Service wallet balance updated.`,
      });
    } catch (error) {
      setDepositState({
        kind: "failed",
        message: userFacingErrorMessage(error, "APT deposit failed"),
      });
    }
  }

  async function sealPackNow(batch: UploadApiBatchResponse) {
    setIsClosingPack(true);
    try {
      await closePackNow(batch.id);
      const refreshed = await getUploadBatchById(batch.id);
      const privateItems = new Map(
        batch.items.map((item) => [
          item.localId,
          { label: item.label, category: item.category, mimeType: item.mimeType },
        ]),
      );
      const completed = {
        ...refreshed,
        items: refreshed.items.map((item) => ({
          ...item,
          ...privateItems.get(item.localId),
        })),
      };
      rememberLocalUploadBatch(completed);
      setState({ kind: "ready", batch: completed });
    } catch (error) {
      setState({
        kind: "failed",
        message:
          error instanceof Error ? error.message : "The pack could not be closed.",
      });
    } finally {
      setIsClosingPack(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-surface-high text-primary">
          <UploadCloud aria-hidden className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Encrypted upload</h2>
          <p className="mt-2 max-w-2xl text-muted">
            Files are encrypted locally, packed as ciphertext, and written to
            Shelby by the service account. Plaintext never leaves this browser.
          </p>
        </div>
      </div>

      <StorageReadinessBanner status={storageStatus} />

      {files.length > 0 ? (
        <section className="mt-5 rounded-xl border border-primary/35 bg-background p-4">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Pack Eligibility & Cost
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {packMode === "Shared Pack"
                  ? "This selection joins a shared Shelby pack because every file is below 10 MiB."
                  : "This selection uses a dedicated Shelby blob because at least one file is 10 MiB or larger."}
              </p>
            </div>
            <span className="rounded-full border border-primary/40 px-3 py-1 font-mono text-xs text-primary">
              {packMode}
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <EligibilityRow
              label="Paying wallet"
              value="Webapp service wallet"
            />
            <EligibilityRow
              label="Upload condition"
              value={
                packMode === "Shared Pack"
                  ? "8.0 MiB pool or 5 minute wait"
                  : "Dedicated upload closes alone"
              }
            />
            <EligibilityRow label="Retention cohort" value={`${retentionDays} days`} />
            <EligibilityRow
              label="Estimated reserve"
              value={formatApt(estimatedReserveOctas)}
            />
            <EligibilityRow
              label="Service wallet available"
              value={
                aptState.kind === "ready" ? formatApt(aptState.availableOctas) : "Loading..."
              }
            />
          </div>
          {insufficientApt ? (
            <div className="mt-4 rounded-lg border border-error/50 bg-surface p-3 text-sm">
              <p className="text-error">
                Service wallet needs {formatApt(estimatedReserveOctas)} for this
                upload. Available:{" "}
                {aptState.kind === "ready" ? formatApt(aptState.availableOctas) : "0 APT"}.
                Missing: {formatApt(missingAptOctas)}.
              </p>
              <button
                type="button"
                onClick={depositMissingApt}
                disabled={!connected || depositState.kind === "depositing"}
                className="mt-3 inline-flex min-h-10 items-center justify-center rounded bg-primary px-4 py-2 text-sm font-semibold text-[#133155] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {depositState.kind === "depositing"
                  ? "Waiting for wallet..."
                  : `Deposit ${formatApt(missingAptOctas)}`}
              </button>
            </div>
          ) : null}
          {depositState.kind === "failed" ? (
            <p className="mt-3 rounded-lg border border-error/40 bg-surface p-3 text-sm text-error">
              {depositState.message}
            </p>
          ) : null}
          {depositState.kind === "confirmed" ? (
            <p className="mt-3 rounded-lg border border-primary/40 bg-surface p-3 text-sm text-muted-strong">
              {depositState.message}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-muted-strong">
            Select files
          </span>
          <div className="rounded-lg border border-border bg-background p-3">
            <input
              id="upload-files"
              aria-label="Select files"
              multiple
              type="file"
              onChange={(event) => {
                setFiles(Array.from(event.currentTarget.files ?? []));
                setState({ kind: "idle" });
              }}
              className="sr-only"
            />
            <label
              htmlFor="upload-files"
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded bg-primary px-4 py-2 text-sm font-semibold text-[#133155] transition-opacity hover:opacity-90"
            >
              Choose files
            </label>
            <span className="ml-3 text-sm text-muted">
              {files.length === 0
                ? "No files selected"
                : `${files.length} file(s) selected`}
            </span>
          </div>
        </label>

        <label className="space-y-2">
          <span className="block text-sm font-semibold text-muted-strong">
            Private local label
          </span>
          <input
            aria-label="Private local label"
            value={label}
            onChange={(event) => setLabel(event.currentTarget.value)}
            placeholder="Example: Personal docs"
            className="min-h-12 w-full rounded-lg border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary"
          />
        </label>

        <label className="space-y-2">
          <span className="block text-sm font-semibold text-muted-strong">
            File type label
          </span>
          <select
            aria-label="File type label"
            value={category}
            onChange={(event) => setCategory(event.currentTarget.value as FileCategory)}
            className="min-h-12 w-full rounded-lg border border-border bg-background px-4 text-sm capitalize text-foreground outline-none transition-colors focus:border-primary"
          >
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="block text-sm font-semibold text-muted-strong">
            Retention
          </span>
          <select
            aria-label="Retention"
            value={retentionDays}
            onChange={(event) =>
              setRetentionDays(Number(event.currentTarget.value) as RetentionCohort)
            }
            className="min-h-12 w-full rounded-lg border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors focus:border-primary"
          >
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={365}>365 days</option>
          </select>
        </label>
      </div>

      <div className="mt-6 flex flex-col gap-4 rounded-xl border border-border bg-background p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <FolderUp aria-hidden className="h-5 w-5 text-primary" />
          <p className="text-sm text-muted">
            <span className="font-mono text-foreground">{files.length}</span> file(s),{" "}
            <span className="font-mono text-foreground">{formatBytes(selectedSize)}</span>{" "}
            selected.
          </p>
        </div>

        {files.length > 0 ? (
          <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
            <p className="font-semibold text-foreground">
              Estimated reserve: {formatApt(estimatedReserveOctas)}
            </p>
            <p className="mt-1 text-xs text-muted">
              Final pack cost is settled by encrypted bytes after the pack closes.
            </p>
            {aptState.kind === "ready" ? (
              <p className="mt-1 text-xs text-muted">
                Service wallet available: {formatApt(aptState.availableOctas)}
              </p>
            ) : null}
          </div>
        ) : null}

        <button
          data-action="upload.encrypt_queue"
          type="button"
          onClick={submitUpload}
          disabled={state.kind === "encrypting" || insufficientApt}
          className="min-h-11 rounded bg-primary px-5 py-2 text-sm font-semibold text-[#133155] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {state.kind === "encrypting"
            ? "Encrypting and staging ciphertext..."
            : "Encrypt and join a pack"}
        </button>
      </div>

      <div aria-live="polite" className="mt-5 rounded-xl border border-border bg-surface-high p-4">
        {state.kind === "idle" ? (
          <p className="text-sm text-muted">
            Ready. Plaintext bytes stay in this browser session.
          </p>
        ) : null}
        {state.kind === "failed" ? (
          <p className="text-sm text-error">{state.message}</p>
        ) : null}
        {state.kind === "encrypting" ? (
          <p className="text-sm text-muted">
            Encrypting locally and staging ciphertext for a shared Shelby pack...
          </p>
        ) : null}
        {state.kind === "ready" ? (
          <div className="flex items-start gap-3">
            <ShieldCheck aria-hidden className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {state.batch.storage ? "Verified Shelby upload" : "Encrypted upload queued"}:{" "}
                <span className="font-mono text-primary">{state.batch.id.slice(0, 8)}</span>
              </p>
              <p className="mt-1 text-sm text-muted">
                Status is <span className="font-mono text-foreground">{state.batch.status}</span>.
              </p>
              {state.batch.billing ? (
                <p className="mt-1 text-sm text-muted">
                  Reserved APT:{" "}
                  <span className="font-mono text-foreground">
                    {formatApt(state.batch.billing.reserveOctas)}
                  </span>
                  .
                </p>
              ) : null}
              {state.batch.storage ? (
                <div className="mt-3 space-y-1 text-sm text-muted">
                  <p>
                    Owner: <span className="font-mono text-foreground">{shortAddress(state.batch.storage.ownerAddress)}</span>
                  </p>
                  <p>
                    Blob: <span className="font-mono text-foreground">{state.batch.storage.blobName}</span>
                  </p>
                  {state.batch.storage.transactionHash ? (
                    <p>
                      Transaction: <span className="font-mono text-foreground">{shortAddress(state.batch.storage.transactionHash)}</span>
                    </p>
                  ) : (
                    <p>Commitment was verified through on-chain blob metadata.</p>
                  )}
                  <button
                    type="button"
                    onClick={() => downloadBatchReceipt(state.batch)}
                    className="mt-3 inline-flex min-h-10 items-center gap-2 rounded border border-border bg-background px-3 py-2 font-semibold text-foreground hover:border-primary"
                  >
                    <Download aria-hidden className="h-4 w-4" />
                    Download receipt.json
                  </button>
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-border bg-background p-4">
                  <p className="text-sm text-muted">
                    Your encrypted bytes are in private staging. A shared pack can
                    accept other uploads with the same retention period before it
                    is committed to Shelby.
                  </p>
                  <button
                    type="button"
                    disabled={isClosingPack}
                    onClick={() => void sealPackNow(state.batch)}
                    className="mt-3 inline-flex min-h-10 items-center gap-2 rounded border border-border bg-surface px-3 py-2 font-semibold text-foreground hover:border-primary disabled:opacity-60"
                  >
                    <PackageCheck aria-hidden className="h-4 w-4" />
                    {isClosingPack ? "Closing and verifying pack..." : "Seal pack now"}
                  </button>
                  <p className="mt-2 text-xs text-muted">
                    Sealing now is useful for testing or urgent storage, but may
                    produce a smaller pack with less cost sharing.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <HelpCard
          title="What this does"
          body="Encrypts selected files locally and uploads only ciphertext to private staging. The service combines queued ciphertext into a shared Shelby blob."
        />
        <HelpCard
          title="How to use it"
          body="Initialize your vault, choose files, set retention, and join a pack. Return to Packs for verification and receipt export after the pack closes."
        />
        <HelpCard
          title="Security checklist"
          body="Save the receipt after upload and keep your recovery kit offline. Do not paste private keys into the app."
        />
      </div>
    </section>
  );
}

async function prepareEncryptedUploadItems(input: {
  files: File[];
  label: string;
  category: FileCategory;
  vaultPublicKey: string;
}): Promise<Array<UploadApiItemInput & { ciphertext: Uint8Array; aad: string }>> {
  const vaultPublicKey = await importVaultPublicKey(
    base64ToBytes(input.vaultPublicKey),
  );

  return Promise.all(
    input.files.map(async (file, index) => {
      const localId = `local-${index}`;
      const plaintext = new Uint8Array(await file.arrayBuffer());
      const dek = randomBytes(32);
      const nonceBase = randomBytes(8);
      const aad = new TextEncoder().encode(`private-rollup:upload:${localId}`);
      const encrypted = await encryptChunkedPayload({
        plaintext,
        key: dek,
        nonceBase,
        aad,
        chunkSize: CHUNK_SIZE_BYTES,
      });
      const ciphertextBytes = concatBytes(
        encrypted.chunks.map((chunk) => chunk.ciphertext),
      );
      const wrappedDek = await wrapDekForVault({
        dek,
        recipientPublicKey: vaultPublicKey,
        aad,
      });

      return {
        localId,
        label: input.files.length === 1 ? input.label : `${input.label} ${index + 1}`,
        category: input.category,
        mimeType: file.type || undefined,
        plaintextSizeBytes: file.size,
        ciphertextSizeBytes: ciphertextBytes.byteLength,
        ciphertextSha256: await sha256Hex(ciphertextBytes),
        encryptedManifest: base64Json({
          magic: encrypted.magic,
          version: encrypted.version,
          algorithm: encrypted.algorithm,
          chunkSize: encrypted.chunkSize,
          chunkCount: encrypted.chunks.length,
          nonceBase: bytesToBase64(encrypted.nonceBase),
          fileNameHash: await sha256Hex(new TextEncoder().encode(file.name)),
        }),
        wrappedDek: serializeWrappedDek(wrappedDek),
        ciphertext: ciphertextBytes,
        aad: bytesToBase64(aad),
      };
    }),
  );
}

function serializeWrappedDek(wrappedDek: WrappedDek) {
  return base64Json({
    suite: wrappedDek.suite,
    enc: bytesToBase64(wrappedDek.enc),
    ciphertext: bytesToBase64(wrappedDek.ciphertext),
  });
}

function toApiUploadItem(
  item: UploadApiItemInput & { ciphertext: Uint8Array; aad: string },
): UploadApiItemInput {
  return {
    localId: item.localId,
    label: "Encrypted file",
    category: "other",
    plaintextSizeBytes: item.plaintextSizeBytes,
    ciphertextSizeBytes: item.ciphertextSizeBytes,
    ciphertextSha256: item.ciphertextSha256,
    encryptedManifest: item.encryptedManifest,
    wrappedDek: item.wrappedDek,
  };
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function base64Json(value: unknown) {
  return bytesToBase64(new TextEncoder().encode(JSON.stringify(value)));
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return globalThis.btoa(binary);
}

function concatBytes(chunks: Uint8Array[]) {
  const output = new Uint8Array(
    chunks.reduce((total, chunk) => total + chunk.byteLength, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function StorageReadinessBanner({ status }: { status: StorageStatus }) {
  if (status.kind === "loading") {
    return (
      <div className="mt-5 rounded-xl border border-border bg-background p-4 text-sm text-muted">
        Checking Shelby storage writer configuration...
      </div>
    );
  }

  if (status.kind === "failed") {
    return (
      <div className="mt-5 rounded-xl border border-border bg-background p-4 text-sm text-muted">
        Storage writer status is unavailable. Uploads can still be encrypted
        and queued locally.
      </div>
    );
  }

  if (!status.ready) {
    return (
      <div className="mt-5 rounded-xl border border-border bg-background p-4 text-sm text-muted">
        <span className="font-semibold text-foreground">
          Storage writer is not configured.
        </span>{" "}
        This app will queue encrypted metadata only until{" "}
        <span className="font-mono text-foreground">{status.missing.join(", ")}</span>{" "}
        is configured for {status.driver} on {status.network}.
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-xl border border-primary/40 bg-background p-4 text-sm text-muted">
      <span className="font-semibold text-foreground">Shelby storage is ready.</span>{" "}
      Uploads are reported as successful only after the blob is committed and
      verified against on-chain metadata.
    </div>
  );
}

function EligibilityRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      aria-label={`${label}: ${value}`}
      className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
    >
      <span className="font-semibold text-muted-strong">
        {label}: <span className="font-mono text-foreground">{value}</span>
      </span>
    </div>
  );
}

function insufficientAptMessage(input: {
  reserveOctas: number;
  availableOctas: number;
  missingOctas: number;
}) {
  return `Service wallet needs ${formatApt(input.reserveOctas)} for this upload. Available: ${formatApt(input.availableOctas)}. Missing: ${formatApt(input.missingOctas)}.`;
}

function userFacingErrorMessage(error: unknown, fallback = "Request failed") {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }
  return fallback;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function shortAddress(value: string) {
  return value.length <= 18 ? value : `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function HelpCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-xl border border-border bg-background p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
    </section>
  );
}
