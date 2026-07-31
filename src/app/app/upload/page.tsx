import { UploadPanel } from "@/features/upload/upload-panel";

export default function UploadPage() {
  return (
    <section className="mx-auto max-w-[1440px] space-y-8">
      <div>
        <h1 className="mb-2 text-5xl font-bold leading-tight text-foreground">
          Upload Queue
        </h1>
        <p className="text-muted">
          Encrypt files in the browser, stage ciphertext, and prepare them for
          shared or dedicated packs.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <UploadPanel />

        <aside className="space-y-4">
          <InfoCard label="Pack threshold" value="< 10 MiB shared" />
          <InfoCard label="Retention cohorts" value="30 / 90 / 365 days" />
          <InfoCard label="Plaintext policy" value="Never leaves browser" />
        </aside>
      </div>
    </section>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-sm font-semibold uppercase text-muted-strong">{label}</p>
      <p className="mt-3 font-mono text-lg text-primary">{value}</p>
    </div>
  );
}
