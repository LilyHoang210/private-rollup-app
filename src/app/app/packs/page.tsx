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

        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          {["Alpha-Genesis-92", "Beta-Storage-04", "Gamma-Vault-11"].map((pack) => (
            <Link
              key={pack}
              data-action="packs.open_detail"
              href="/app/packs/alpha-genesis-92"
              className="rounded-xl border border-border bg-background p-5 transition-colors hover:border-primary"
            >
              <p className="font-mono text-sm text-foreground">{pack}</p>
              <p className="mt-2 text-sm text-muted">Contribution indexed for demo.</p>
              <p className="mt-4 font-mono text-xs text-primary">Open detail</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
