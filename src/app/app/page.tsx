import Link from "next/link";

export default function DashboardPage() {
  return (
    <section className="mx-auto max-w-[1440px] space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="mb-2 text-5xl font-bold leading-tight text-foreground">
            Dashboard Overview
          </h1>
          <p className="text-muted">Monitor encrypted assets and pack states.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Metric label="Active Packs" value="12" />
        <Metric label="Encrypted Files" value="1,048" />
        <Metric label="User Bytes" value="4.2 GB" />
        <Metric label="Expiring < 30 Days" value="3" tone="attention" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border bg-surface-low p-6">
              <h2 className="text-2xl font-semibold text-foreground">
                Pack Participation
              </h2>
              <Link
                data-action="nav.packs"
                href="/app/packs"
                className="text-sm font-semibold text-primary hover:underline"
              >
                View All
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-[#060e20]">
                    <TableHead>Pack / Status</TableHead>
                    <TableHead>Files</TableHead>
                    <TableHead>Contribution</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <PackRow
                    name="Alpha-Genesis-92"
                    status="Verified"
                    files="24"
                    contribution="15%"
                    bytes="1.2 GB / 8 GB"
                    expiration="2027-11-15"
                    tone="ok"
                  />
                  <PackRow
                    name="Beta-Storage-04"
                    status="Expiring Soon"
                    files="128"
                    contribution="45%"
                    bytes="3.6 GB / 8 GB"
                    expiration="2026-08-12"
                    tone="attention"
                  />
                  <PackRow
                    name="Gamma-Vault-11"
                    status="Sealing"
                    files="5"
                    contribution="2%"
                    bytes="0.1 GB / 8 GB"
                    expiration="2027-01-20"
                    tone="neutral"
                  />
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-8">
          <section className="relative overflow-hidden rounded-xl border border-error/50 bg-surface">
            <div className="absolute left-0 top-0 h-1 w-full bg-error" />
            <div className="border-b border-border bg-surface-low p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                Action Required
              </h2>
            </div>
            <div className="space-y-3 p-4">
              <ExpirationItem name="Beta-Storage-04" days="12 days left" width="80%" />
              <ExpirationItem name="Delta-Archive-01" days="28 days left" width="40%" />
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="border-b border-border bg-surface-low p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                Recent Activity
              </h2>
            </div>
            <ul className="divide-y divide-border">
              <Activity text="Encrypted config_v2.json" time="2 hours ago" />
              <Activity text="Pack Alpha-Genesis-92 verified" time="Yesterday at 14:32" />
              <Activity text="Recovery key validated" time="Oct 18, 2026" />
            </ul>
          </section>
        </aside>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "attention";
}) {
  const textColor = tone === "attention" ? "text-error" : "text-foreground";
  return (
    <div className="flex h-32 flex-col justify-between rounded-xl border border-border bg-surface p-6 transition-colors hover:border-primary">
      <p className={`text-sm font-semibold uppercase ${tone === "attention" ? "text-error" : "text-muted-strong"}`}>
        {label}
      </p>
      <p className={`text-4xl font-bold ${textColor}`}>{value}</p>
    </div>
  );
}

function TableHead({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`px-6 py-3 text-sm font-semibold uppercase text-muted-strong ${className}`}>
      {children}
    </th>
  );
}

function PackRow({
  name,
  status,
  files,
  contribution,
  bytes,
  expiration,
  tone,
}: {
  name: string;
  status: string;
  files: string;
  contribution: string;
  bytes: string;
  expiration: string;
  tone: "ok" | "attention" | "neutral";
}) {
  const statusColor =
    tone === "ok" ? "text-accent" : tone === "attention" ? "text-error" : "text-primary";

  return (
    <tr className="group transition-colors hover:bg-surface-high">
      <td className="px-6 py-4">
        <div>
          <div className="font-mono text-sm text-foreground">{name}</div>
          <div className={`font-mono text-xs ${statusColor}`}>{status}</div>
        </div>
      </td>
      <td className="px-6 py-4 text-muted">{files}</td>
      <td className="px-6 py-4 text-muted">
        <span>{contribution}</span>
        <span className="ml-2 font-mono text-xs text-muted-strong">({bytes})</span>
      </td>
      <td className={`px-6 py-4 font-mono text-sm ${tone === "attention" ? "text-error" : "text-muted"}`}>
        {expiration}
      </td>
      <td className="px-6 py-4 text-right">
        <Link
          data-action="packs.open_detail"
          href="/app/packs/alpha-genesis-92"
          className="text-sm font-semibold text-muted opacity-100 transition-colors hover:text-primary md:opacity-0 md:group-hover:opacity-100"
        >
          Open
        </Link>
      </td>
    </tr>
  );
}

function ExpirationItem({
  name,
  days,
  width,
}: {
  name: string;
  days: string;
  width: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-highest p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="truncate font-mono text-sm text-foreground">{name}</div>
        <span className="whitespace-nowrap font-mono text-xs text-error">{days}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background">
        <div className="h-full rounded-full bg-error" style={{ width }} />
      </div>
      <a
        data-action="receipt.export_all"
        href="/app/recovery"
        className="mt-3 flex min-h-9 w-full items-center justify-center rounded border border-border bg-background text-sm font-semibold text-foreground transition-colors hover:border-primary"
      >
        Export receipts
      </a>
    </div>
  );
}

function Activity({ text, time }: { text: string; time: string }) {
  return (
    <li className="flex gap-4 p-4 transition-colors hover:bg-surface-high">
      <div className="mt-1 h-8 w-8 flex-shrink-0 rounded-full bg-primary-container" />
      <div>
        <p className="text-sm text-foreground">{text}</p>
        <p className="mt-1 text-xs text-muted-strong">{time}</p>
      </div>
    </li>
  );
}
