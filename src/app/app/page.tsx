import Link from "next/link";

export default function DashboardPage() {
  return (
    <section className="mx-auto max-w-[1440px] space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="mb-2 text-5xl font-bold leading-tight text-foreground">
            Dashboard Overview
          </h1>
          <p className="max-w-3xl text-muted">
            Monitor your encrypted upload batches and blob-pack participation.
            This dashboard only shows live data after setup and upload flows are
            connected for your wallet session.
          </p>
        </div>
        <Link
          href="/app/setup"
          className="flex min-h-11 items-center justify-center rounded bg-primary px-5 py-2 text-sm font-semibold text-[#133155] transition-opacity hover:opacity-90"
        >
          Start setup
        </Link>
      </div>

      <section className="rounded-xl border border-primary/40 bg-surface p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="font-mono text-sm uppercase tracking-wider text-primary">
              First safe step
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">
              Complete the Secure Setup Wizard before uploading important files.
            </h2>
            <p className="mt-2 max-w-3xl text-muted">
              The wizard explains the privacy model, vault material, upload
              labels, receipts, and local CLI recovery before you trust the app
              with real encrypted uploads.
            </p>
          </div>
          <Link
            href="/app/setup"
            className="flex min-h-11 shrink-0 items-center justify-center rounded border border-border bg-background px-5 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary"
          >
            Open Wizard
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Metric label="Active Packs" value="0" />
        <Metric label="Encrypted Files" value="0" />
        <Metric label="Stored Bytes" value="0 B" />
        <Metric label="Expiring < 30 Days" value="0" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
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
            <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center">
              <h3 className="text-2xl font-semibold text-foreground">
                No live packs yet
              </h3>
              <p className="mx-auto mt-3 max-w-2xl text-muted">
                Your wallet is connected, but this workspace does not have live
                encrypted uploads or blob-pack participation records yet. Start
                with the wizard, then upload a small test file.
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
          </div>
        </section>

        <aside className="space-y-8">
          <section className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="border-b border-border bg-surface-low p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                Next safe steps
              </h2>
            </div>
            <ol className="space-y-4 p-6 text-sm text-muted">
              <li>
                <span className="font-semibold text-foreground">1.</span> Review
                the setup wizard so you understand what stays local.
              </li>
              <li>
                <span className="font-semibold text-foreground">2.</span> Initialize
                vault material before uploading real files.
              </li>
              <li>
                <span className="font-semibold text-foreground">3.</span> Upload a
                small test file and keep the receipt outside the website.
              </li>
              <li>
                <span className="font-semibold text-foreground">4.</span> Practice
                local CLI recovery before relying on the workflow.
              </li>
            </ol>
          </section>
        </aside>
      </div>
    </section>
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
