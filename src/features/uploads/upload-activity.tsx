"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { formatApt } from "@/client/api/apt-account";
import type { UploadApiBatchResponse } from "@/client/api/uploads";
import { listPackPools, listUploadBatches, type PackPoolResponse } from "@/client/api/uploads";
import {
  mergeUploadBatches,
  readLocalUploadBatches,
} from "@/client/uploads/local-upload-cache";
import { downloadBatchReceipt } from "@/client/recovery/receipt-download";

type UploadActivityState =
  | { kind: "loading" }
  | { kind: "ready"; batches: UploadApiBatchResponse[] }
  | { kind: "failed" };

type PackPoolState =
  | { kind: "loading" }
  | { kind: "ready"; pools: PackPoolResponse[] }
  | { kind: "failed" };

const EMPTY_BATCHES: UploadApiBatchResponse[] = [];
const EMPTY_POOLS: PackPoolResponse[] = [];

export function DashboardUploadActivity() {
  const state = useUploadActivity();
  const batches = state.kind === "ready" ? state.batches : EMPTY_BATCHES;
  const metrics = useMemo(() => summarizeBatches(batches), [batches]);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 self-start lg:col-span-3">
        <Metric label="Queued Batches" value={String(metrics.queuedBatches)} />
        <Metric label="Encrypted Files" value={String(metrics.fileCount)} />
        <Metric label="Queued Bytes" value={formatBytes(metrics.bytes)} />
        <Metric label="Expiring < 30 Days" value={String(metrics.expiringSoon)} />
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface lg:col-span-2">
        <div className="flex items-center justify-between border-b border-border bg-surface-low p-6">
          <h2 className="text-2xl font-semibold text-foreground">
            Pack Participation
          </h2>
          <Link
            data-action="nav.packs"
            href="/app/packs"
            className="text-sm font-semibold text-primary hover:underline"
          >
            View packs
          </Link>
        </div>
        <div className="p-8">
          {state.kind === "loading" ? (
            <StatusPanel title="Loading upload activity" body="Checking queued encrypted uploads for this wallet session." />
          ) : null}
          {state.kind === "failed" ? (
            <StatusPanel title="Connect wallet to load upload activity" body="Dashboard data is wallet-scoped. Connect again if your browser session was refreshed." />
          ) : null}
          {state.kind === "ready" && batches.length === 0 ? <EmptyDashboardState /> : null}
          {state.kind === "ready" && batches.length > 0 ? (
            <div className="space-y-3">
              {batches.slice(0, 5).map((batch) => (
                <BatchCard key={batch.id} batch={batch} />
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

export function PacksUploadActivity() {
  const state = useUploadActivity();
  const poolState = usePackPools();
  const batches = state.kind === "ready" ? state.batches : EMPTY_BATCHES;
  const pools = poolState.kind === "ready" ? poolState.pools : EMPTY_POOLS;
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("expiration");
  const visibleBatches = useMemo(
    () => filterAndSortBatches(batches, query, statusFilter, sortBy),
    [batches, query, statusFilter, sortBy],
  );

  if (state.kind === "loading") {
    return (
      <div className="p-8">
        <StatusPanel title="Loading pack queue" body="Checking queued encrypted uploads for this wallet session." />
      </div>
    );
  }

  if (state.kind === "failed") {
    return (
      <>
        <PackPoolPanel pools={pools} state={poolState.kind} />
        <div className="p-8">
          <StatusPanel title="Connect wallet to load pack queue" body="Pack participation is wallet-scoped. Connect again if your browser session was refreshed." />
        </div>
      </>
    );
  }

  if (batches.length === 0) {
    return (
      <>
        <PackPoolPanel pools={pools} state={poolState.kind} />
        <PackControls
          query={query}
          statusFilter={statusFilter}
          sortBy={sortBy}
          onQueryChange={setQuery}
          onStatusFilterChange={setStatusFilter}
          onSortByChange={setSortBy}
        />
        <div className="p-8">
          <EmptyPacksState />
        </div>
      </>
    );
  }

  return (
    <>
      <PackPoolPanel pools={pools} state={poolState.kind} />
      <PackControls
        query={query}
        statusFilter={statusFilter}
        sortBy={sortBy}
        onQueryChange={setQuery}
        onStatusFilterChange={setStatusFilter}
        onSortByChange={setSortBy}
      />
      {visibleBatches.length === 0 ? (
        <div className="p-8">
          <StatusPanel
            title="No matching packs"
            body="Adjust the search text, status filter, or sort option to inspect other encrypted upload batches."
          />
        </div>
      ) : (
        <div className="divide-y divide-border">
          {visibleBatches.map((batch) => (
            <article
              key={batch.id}
              className="grid gap-4 p-5 md:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_0.8fr]"
            >
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-primary">
                  Batch {batch.id.slice(0, 8)}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">
                  {batch.items[0]?.label ?? "Encrypted upload"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {batch.storage
                    ? `${formatFileCount(batch.items.length)} stored in a verified Shelby blob.`
                    : `${formatFileCount(batch.items.length)} queued through the streamlined upload pipeline.`}
                </p>
              </div>
              <PackFact label="Status" value={statusLabel(batch.status)} />
              <PackFact
                label="Strategy"
                value={
                  batch.storage
                    ? "Dedicated encrypted pack"
                    : strategyLabel(batch.items[0]?.packStrategy)
                }
              />
              <PackFact label="Retention" value={`${batch.retentionDays} days`} />
              <PackFact label="Cost share" value={billingLabel(batch)} />
              {batch.storage ? (
                <button
                  type="button"
                  onClick={() => downloadBatchReceipt(batch)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded border border-border bg-background px-3 text-sm font-semibold text-foreground hover:border-primary md:col-span-5 md:justify-self-end"
                >
                  <Download aria-hidden className="h-4 w-4" />
                  Download receipt
                </button>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function usePackPools() {
  const [state, setState] = useState<PackPoolState>({ kind: "loading" });

  useEffect(() => {
    let active = true;

    void listPackPools()
      .then(({ pools }) => {
        if (active) {
          setState({ kind: "ready", pools: Array.isArray(pools) ? pools : [] });
        }
      })
      .catch(() => {
        if (active) {
          setState({ kind: "failed" });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}

function useUploadActivity() {
  const [state, setState] = useState<UploadActivityState>({ kind: "loading" });

  useEffect(() => {
    let active = true;

    void listUploadBatches()
      .then(({ batches }) => {
        if (active) {
          setState({
            kind: "ready",
            batches: mergeUploadBatches(batches, readLocalUploadBatches()),
          });
        }
      })
      .catch(() => {
        if (active) {
          const localBatches = readLocalUploadBatches();
          setState(
            localBatches.length > 0
              ? { kind: "ready", batches: localBatches }
              : { kind: "failed" },
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}

function PackControls({
  onQueryChange,
  onSortByChange,
  onStatusFilterChange,
  query,
  sortBy,
  statusFilter,
}: {
  onQueryChange: (value: string) => void;
  onSortByChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  query: string;
  sortBy: string;
  statusFilter: string;
}) {
  return (
    <div className="grid gap-3 border-b border-border bg-surface-low p-4 md:grid-cols-3">
      <input
        aria-label="Search packs"
        className="min-h-11 rounded border border-border bg-background px-3 text-foreground outline-none focus:border-primary"
        placeholder="Search pack or blob"
        value={query}
        onChange={(event) => onQueryChange(event.currentTarget.value)}
      />
      <select
        aria-label="Filter status"
        className="min-h-11 rounded border border-border bg-background px-3 text-foreground outline-none focus:border-primary"
        value={statusFilter}
        onChange={(event) => onStatusFilterChange(event.currentTarget.value)}
      >
        <option value="all">All statuses</option>
        <option value="verified">Verified</option>
        <option value="sealing">Sealing</option>
        <option value="expiring">Expiring soon</option>
      </select>
      <select
        aria-label="Sort packs"
        className="min-h-11 rounded border border-border bg-background px-3 text-foreground outline-none focus:border-primary"
        value={sortBy}
        onChange={(event) => onSortByChange(event.currentTarget.value)}
      >
        <option value="expiration">Expiration first</option>
        <option value="created">Newest first</option>
        <option value="bytes">Largest contribution</option>
      </select>
    </div>
  );
}

function PackPoolPanel({
  pools,
  state,
}: {
  pools: PackPoolResponse[];
  state: PackPoolState["kind"];
}) {
  const visiblePools = pools.filter((pool) => pool.waitingBatchCount > 0);

  return (
    <section className="border-b border-border bg-background p-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            Waiting Pack Pool
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            Shared packs upload to Shelby when a retention pool reaches{" "}
            <span className="font-mono text-foreground">8.0 MiB</span> or when
            the oldest waiting batch reaches{" "}
            <span className="font-mono text-foreground">5 minutes</span>. Only
            uploads with the same retention period are packed together.
          </p>
        </div>
        <p className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs text-muted-strong">
          Shared max: 50.0 MiB
        </p>
      </div>

      {state === "loading" ? (
        <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-muted">
          Loading pack pool progress...
        </p>
      ) : null}

      {state === "failed" ? (
        <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-muted">
          Pack pool progress is unavailable. Your upload list can still be inspected.
        </p>
      ) : null}

      {state === "ready" && visiblePools.length === 0 ? (
        <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-muted">
          No shared pack pools are waiting for this wallet session.
        </p>
      ) : null}

      {visiblePools.length > 0 ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {visiblePools.map((pool) => (
            <article
              key={pool.retentionDays}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-foreground">
                  {pool.retentionDays}-day pool
                </h3>
                <span className="rounded-full border border-primary/40 px-3 py-1 font-mono text-xs text-primary">
                  {formatBatchCount(pool.waitingBatchCount)}
                </span>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-surface-high">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${Math.max(2, Math.round(pool.progressRatio * 100))}%`,
                  }}
                />
              </div>
              <p className="mt-3 font-mono text-sm text-foreground">
                {formatBytes(pool.queuedBytes)} / {formatBytes(pool.targetBytes)}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {packPoolTriggerCopy(pool)}
              </p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function filterAndSortBatches(
  batches: UploadApiBatchResponse[],
  query: string,
  statusFilter: string,
  sortBy: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = batches.filter((batch) => {
    const text = [
      batch.id,
      batch.status,
      statusLabel(batch.status),
      strategyLabel(batch.items[0]?.packStrategy),
      ...batch.items.map((item) => item.label),
    ]
      .join(" ")
      .toLowerCase();

    const matchesQuery = !normalizedQuery || text.includes(normalizedQuery);
    const matchesStatus = matchesStatusFilter(batch, statusFilter);
    return matchesQuery && matchesStatus;
  });

  return [...filtered].sort((left, right) => {
    if (sortBy === "bytes") {
      return right.totalCiphertextSizeBytes - left.totalCiphertextSizeBytes;
    }
    if (sortBy === "created") {
      return String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? ""));
    }

    if (left.retentionDays !== right.retentionDays) {
      return left.retentionDays - right.retentionDays;
    }

    return String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? ""));
  });
}

function matchesStatusFilter(batch: UploadApiBatchResponse, statusFilter: string) {
  if (statusFilter === "verified") {
    return batch.status === "available";
  }

  if (statusFilter === "sealing") {
    return ["packing", "registering", "written", "verifying"].includes(batch.status);
  }

  if (statusFilter === "expiring") {
    return batch.retentionDays === 30;
  }

  return true;
}

function summarizeBatches(batches: UploadApiBatchResponse[]) {
  return {
    queuedBatches: batches.filter((batch) => batch.status === "waiting_for_pack").length,
    fileCount: batches.reduce((total, batch) => total + batch.items.length, 0),
    bytes: batches.reduce((total, batch) => total + batch.totalCiphertextSizeBytes, 0),
    expiringSoon: batches.filter((batch) => batch.retentionDays === 30).length,
  };
}

function BatchCard({ batch }: { batch: UploadApiBatchResponse }) {
  return (
    <article className="rounded-xl border border-border bg-background p-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-primary">
            Batch {batch.id.slice(0, 8)}
          </p>
          <h3 className="mt-1 text-xl font-semibold text-foreground">
            {batch.items[0]?.label ?? "Encrypted upload"}
          </h3>
          <p className="mt-2 text-sm text-muted">
            {formatFileCount(batch.items.length)}, {formatBytes(batch.totalCiphertextSizeBytes)}.
            Status is {statusLabel(batch.status).toLowerCase()}.
          </p>
          {batch.billing ? (
            <p className="mt-2 text-sm font-semibold text-foreground">
              {billingSummary(batch)}
            </p>
          ) : null}
          {batch.storage ? (
            <button
              type="button"
              onClick={() => downloadBatchReceipt(batch)}
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground hover:border-primary"
            >
              <Download aria-hidden className="h-4 w-4" />
              Download receipt
            </button>
          ) : null}
        </div>
        <span className="rounded-full border border-primary/40 px-3 py-1 font-mono text-xs text-primary">
          {statusLabel(batch.status)}
        </span>
      </div>
    </article>
  );
}

function EmptyDashboardState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center">
      <h3 className="text-2xl font-semibold text-foreground">No live packs yet</h3>
      <p className="mx-auto mt-3 max-w-2xl text-muted">
        Your wallet is connected, but this workspace does not have live encrypted
        uploads or blob-pack participation records yet. Start with the wizard,
        then upload a small test file.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          href="/app/setup"
          className="flex min-h-11 items-center justify-center rounded bg-primary px-5 py-2 text-sm font-semibold text-[#133155] transition-opacity hover:opacity-90"
        >
          Start setup
        </Link>
        <Link
          href="/app/upload"
          className="flex min-h-11 items-center justify-center rounded border border-border bg-surface px-5 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary"
        >
          Upload test file
        </Link>
      </div>
    </div>
  );
}

function EmptyPacksState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center">
      <h2 className="text-2xl font-semibold text-foreground">
        No pack participation yet
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-muted">
        Packs will appear here after encrypted uploads are staged and assigned
        to shared or dedicated blob storage. Start with a small test upload so
        you can inspect the receipt and recovery path.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          href="/app/upload"
          className="flex min-h-11 items-center justify-center rounded bg-primary px-5 py-2 text-sm font-semibold text-[#133155] transition-opacity hover:opacity-90"
        >
          Upload a test file
        </Link>
        <Link
          href="/app/recovery"
          className="flex min-h-11 items-center justify-center rounded border border-border bg-surface px-5 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary"
        >
          Review recovery
        </Link>
      </div>
    </div>
  );
}

function StatusPanel({ body, title }: { body: string; title: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center">
      <h3 className="text-2xl font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-3 max-w-2xl text-muted">{body}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      role="group"
      aria-label={`${label}: ${value}`}
      className="flex min-h-16 min-w-0 flex-row items-center justify-between gap-4 rounded-xl border border-border bg-surface px-5 py-4 transition-colors hover:border-primary sm:px-6"
    >
      <p className="min-w-0 text-sm font-semibold leading-snug text-foreground sm:text-base">
        <span>{label}</span>
        <span className="text-muted-strong"> :</span>
      </p>
      <p className="shrink-0 whitespace-nowrap text-2xl font-bold leading-none text-foreground sm:text-3xl">
        {value}
      </p>
    </div>
  );
}

function PackFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-strong">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function statusLabel(status: string) {
  const label = status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return label.charAt(0) + label.slice(1).toLowerCase();
}

function strategyLabel(strategy?: string) {
  if (strategy === "dedicated_blob") {
    return "Dedicated blob";
  }
  return "Shared pack";
}

function billingSummary(batch: UploadApiBatchResponse) {
  if (!batch.billing) {
    return "No APT reserve";
  }
  if (batch.billing.paymentStatus === "settled" && batch.billing.settledOctas !== undefined) {
    return `Settled: ${formatApt(batch.billing.settledOctas)}`;
  }
  if (batch.billing.paymentStatus === "payment_required") {
    return `Payment required: ${formatApt(batch.billing.reserveOctas)}`;
  }
  return `Reserved: ${formatApt(batch.billing.reserveOctas)}`;
}

function billingLabel(batch: UploadApiBatchResponse) {
  if (!batch.billing) {
    return "Pending estimate";
  }
  if (batch.billing.paymentStatus === "settled" && batch.billing.settledOctas !== undefined) {
    return formatApt(batch.billing.settledOctas);
  }
  return formatApt(batch.billing.reserveOctas);
}

function formatFileCount(count: number) {
  return count === 1 ? "1 file" : `${count} files`;
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

function formatBatchCount(count: number) {
  return count === 1 ? "1 waiting batch" : `${count} waiting batches`;
}

function formatCountdown(seconds?: number) {
  if (seconds === undefined) return "05:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function packPoolTriggerCopy(pool: PackPoolResponse) {
  if (pool.trigger === "byte_threshold") {
    return `Ready to upload because the pool reached ${formatBytes(pool.targetBytes)}.`;
  }
  if (pool.trigger === "wait_time") {
    return "Ready to upload because the oldest batch reached 5 minutes.";
  }
  return `Auto-upload in ${formatCountdown(pool.secondsRemaining)} unless the pool reaches ${formatBytes(pool.targetBytes)} first.`;
}
