import Link from "next/link";

export default function PacksPage() {
  return (
    <section className="mx-auto max-w-[1440px] space-y-8">
      <div>
        <h1 className="mb-2 text-5xl font-bold leading-tight text-foreground">
          Pack Participation
        </h1>
        <p className="text-muted">
          Search, filter, and inspect the encrypted packs that include your
          files.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface">
        <div className="grid gap-3 border-b border-border bg-surface-low p-4 md:grid-cols-3">
          <input
            aria-label="Search packs"
            className="min-h-11 rounded border border-border bg-background px-3 text-foreground outline-none focus:border-primary"
            placeholder="Search pack or blob"
          />
          <select
            aria-label="Filter status"
            className="min-h-11 rounded border border-border bg-background px-3 text-foreground outline-none focus:border-primary"
            defaultValue="all"
          >
            <option value="all">All statuses</option>
            <option value="verified">Verified</option>
            <option value="sealing">Sealing</option>
            <option value="expiring">Expiring soon</option>
          </select>
          <select
            aria-label="Sort packs"
            className="min-h-11 rounded border border-border bg-background px-3 text-foreground outline-none focus:border-primary"
            defaultValue="expiration"
          >
            <option value="expiration">Expiration first</option>
            <option value="created">Newest first</option>
            <option value="bytes">Largest contribution</option>
          </select>
        </div>

        <div className="p-8">
          <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center">
            <h2 className="text-2xl font-semibold text-foreground">
              No pack participation yet
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted">
              Packs will appear here after encrypted uploads are staged and
              assigned to shared or dedicated blob storage. Start with a small
              test upload so you can inspect the receipt and recovery path.
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
        </div>
      </div>
    </section>
  );
}
