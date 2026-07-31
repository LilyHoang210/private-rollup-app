import Link from "next/link";

const cliCommands = [
  "private-rollup recovery import ./recovery-kit.json",
  "private-rollup files list --receipts ./receipts",
  "private-rollup files pull <file-id> --receipt ./receipt.json --output ./restored",
];

export default function DocumentationPage() {
  return (
    <section className="mx-auto max-w-[1440px] space-y-8">
      <div>
        <h1 className="mb-2 text-5xl font-bold leading-tight text-foreground">
          Documentation
        </h1>
        <p className="max-w-3xl text-muted">
          Practical notes for encrypted uploads, shared blob packs, and local
          recovery workflows.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-2xl font-semibold text-foreground">Core workflow</h2>
          <div className="mt-5 space-y-4 text-sm text-muted">
            <p>
              Use <span className="font-mono text-primary">File Upload</span> for
              selecting files and encrypting them locally before the control plane
              receives metadata.
            </p>
            <p>
              Use <span className="font-mono text-primary">Blob Packs</span> to
              inspect shared or dedicated storage packages, retention windows, and
              participation status.
            </p>
            <p>
              Use <span className="font-mono text-primary">Recovery</span> to
              initialize vault material and copy local CLI recovery commands.
            </p>
          </div>
        </section>

        <aside className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-2xl font-semibold text-foreground">Quick links</h2>
          <div className="mt-5 grid gap-3">
            <DocLink href="/app/upload" label="Open File Upload" />
            <DocLink href="/app/packs" label="Open Blob Packs" />
            <DocLink href="/app/recovery" label="Open Recovery" />
          </div>
        </aside>
      </div>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-2xl font-semibold text-foreground">CLI recovery commands</h2>
        <pre className="mt-5 overflow-x-auto rounded-lg border border-border bg-background p-4 font-mono text-sm text-primary">
          {cliCommands.join("\n")}
        </pre>
      </section>
    </section>
  );
}

function DocLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold text-muted transition-colors hover:border-primary hover:text-foreground"
    >
      {label}
    </Link>
  );
}
