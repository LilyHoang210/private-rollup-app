export default async function PackDetailPage({
  params,
}: {
  params: Promise<{ packId: string }>;
}) {
  const { packId } = await params;

  return (
    <section className="mx-auto max-w-[1440px] space-y-8">
      <div>
        <p className="font-mono text-sm text-primary">{packId}</p>
        <h1 className="mb-2 mt-2 text-5xl font-bold leading-tight text-foreground">
          Pack Detail
        </h1>
        <p className="text-muted">
          Contribution, lifecycle, receipt, and storage metadata for this pack.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <DetailCard label="Status" value="Verified" />
        <DetailCard label="Retention" value="365 days" />
        <DetailCard label="Driver" value="local" />
      </div>
    </section>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-sm font-semibold uppercase text-muted-strong">{label}</p>
      <p className="mt-3 font-mono text-lg text-primary">{value}</p>
    </div>
  );
}
