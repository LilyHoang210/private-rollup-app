import Link from "next/link";

const checks = [
  "Confirm the vault is initialized before uploading files.",
  "Keep the recovery kit and receipts outside the web app.",
  "Use local CLI recovery when the web app is unavailable.",
];

export default function SupportPage() {
  return (
    <section className="mx-auto max-w-[1440px] space-y-8">
      <div>
        <h1 className="mb-2 text-5xl font-bold leading-tight text-foreground">
          Support
        </h1>
        <p className="max-w-3xl text-muted">
          Operational guidance for the private rollup MVP. This page keeps
          recovery-first actions visible without sending secrets to support staff.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-2xl font-semibold text-foreground">Before reporting an issue</h2>
          <ul className="mt-5 space-y-3 text-sm text-muted">
            {checks.map((check) => (
              <li key={check} className="rounded-lg border border-border bg-background p-4">
                {check}
              </li>
            ))}
          </ul>
        </section>

        <aside className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-2xl font-semibold text-foreground">Recovery-first help</h2>
          <p className="mt-4 text-sm text-muted">
            If the service is unavailable, restore through the local CLI with
            receipts and your recovery kit.
          </p>
          <Link
            href="/app/documentation"
            className="mt-6 flex min-h-11 items-center justify-center rounded bg-primary px-4 py-2 text-sm font-semibold text-[#133155] transition-opacity hover:opacity-90"
          >
            Open Documentation
          </Link>
        </aside>
      </div>
    </section>
  );
}
