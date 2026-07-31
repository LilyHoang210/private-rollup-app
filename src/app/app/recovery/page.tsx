import { VaultSetupPanel } from "@/features/recovery/vault-setup";

export default function RecoveryPage() {
  return (
    <section className="mx-auto max-w-[1440px] space-y-8">
      <div>
        <h1 className="mb-2 text-5xl font-bold leading-tight text-foreground">
          Recovery Console
        </h1>
        <p className="text-muted">
          Export recovery material and use local CLI commands to restore files
          without relying on the web service.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <VaultSetupPanel />

        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-2xl font-semibold text-foreground">CLI commands</h2>
          <pre className="mt-6 overflow-x-auto rounded border border-border bg-background p-4 font-mono text-sm text-primary">
{`private-rollup recovery import ./recovery-kit.json
private-rollup files list --receipts ./receipts
private-rollup files pull <file-id> --receipt ./receipt.json --output ./restored`}
          </pre>
        </section>
      </div>
    </section>
  );
}
