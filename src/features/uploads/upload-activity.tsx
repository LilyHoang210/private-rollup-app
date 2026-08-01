"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatCredits } from "@/client/api/credits";
import type { UploadApiBatchResponse } from "@/client/api/uploads";
import { listUploadBatches } from "@/client/api/uploads";
import {
  mergeUploadBatches,
  readLocalUploadBatches,
} from "@/client/uploads/local-upload-cache";

type UploadActivityState =
  | { kind: "loading" }
  | { kind: "ready"; batches: UploadApiBatchResponse[] }
  | { kind: "failed" };

const EMPTY_BATCHES: UploadApiBatchResponse[] = [];

export function DashboardUploadActivity() {
  const state = useUploadActivity();
  const batches = state.kind === "ready" ? state.batches : EMPTY_BATCHES;
  const metrics = useMemo(() => summarizeBatches(batches), [batches]);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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
  const batches = state.kind === "ready" ? state.batches : EMPTY_BATCHES;
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
      <div className="p-8">
        <StatusPanel title="Connect wallet to load pack queue" body="Pack participation is wallet-scoped. Connect again if your browser session was refreshed." />
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <>
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
                  {formatFileCount(batch.items.length)} queued through the streamlined
                  upload pipeline.
                </p>
              </div>
              <PackFact label="Status" value={statusLabel(batch.status)} />
              <PackFact label="Strategy" value={strategyLabel(batch.items[0]?.packStrategy)} />
              <PackFact label="Retention" value={`${batch.retentionDays} days`} />
              <PackFact label="Cost share" value={billingLabel(batch)} />
            </article>
          ))}
        </div>
      )}
    </>
  );
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
    <div className="flex h-32 flex-col justify-between rounded-xl border border-border bg-surface p-6 transition-colors hover:border-primary">
      <p className="text-sm font-semibold uppercase text-muted-strong">{label}</p>
      <p className="text-4xl font-bold text-foreground">{value}</p>
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
    return "No credit reserve";
  }
  if (batch.billing.creditStatus === "settled" && batch.billing.settledMicrocredits !== undefined) {
    return `Settled: ${formatCredits(batch.billing.settledMicrocredits)}`;
  }
  if (batch.billing.creditStatus === "payment_required") {
    return `Payment required: ${formatCredits(batch.billing.reserveMicrocredits)}`;
  }
  return `Reserved: ${formatCredits(batch.billing.reserveMicrocredits)}`;
}

function billingLabel(batch: UploadApiBatchResponse) {
  if (!batch.billing) {
    return "Pending estimate";
  }
  if (batch.billing.creditStatus === "settled" && batch.billing.settledMicrocredits !== undefined) {
    return formatCredits(batch.billing.settledMicrocredits);
  }
  return formatCredits(batch.billing.reserveMicrocredits);
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
