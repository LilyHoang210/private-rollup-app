import Link from "next/link";
import { DashboardUploadActivity } from "@/features/uploads/upload-activity";

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

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <DashboardUploadActivity />

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
