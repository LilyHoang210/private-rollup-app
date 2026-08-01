import { PacksUploadActivity } from "@/features/uploads/upload-activity";

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
        <PacksUploadActivity />
      </div>
    </section>
  );
}
