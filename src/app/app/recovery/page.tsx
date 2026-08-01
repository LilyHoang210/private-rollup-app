import Link from "next/link";
import { CopyCommand } from "@/components/copy-command";
import { VaultSetupPanel } from "@/features/recovery/vault-setup";

const recoveryCommands = [
  {
    title: "Import recovery kit",
    label: "import recovery kit command",
    command: "private-rollup recovery import ./recovery-kit.json",
    helper:
      "The key comes from recovery-kit.json. Do not paste private keys into the website or terminal.",
  },
  {
    title: "List files from receipts",
    label: "list receipts command",
    command: "private-rollup files list --receipts ./receipts",
    helper:
      "Use the folder where you store receipt.json files after uploads.",
  },
  {
    title: "Pull one restored file",
    label: "restore one file command",
    command:
      "private-rollup files pull <file-id> --receipt ./receipt.json --output ./restored",
    helper:
      "Replace <file-id> with the file ID from the list command or receipt.json.",
  },
];

export default function RecoveryPage() {
  return (
    <section className="mx-auto max-w-[1440px] space-y-8">
      <div>
        <p className="font-mono text-sm uppercase tracking-wider text-primary">
          Local restore path
        </p>
        <h1 className="mt-2 text-5xl font-bold leading-tight text-foreground">
          Recovery Console
        </h1>
        <p className="mt-3 max-w-3xl text-muted">
          Export recovery material and use local CLI commands to restore files
          without relying on the web service.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <GuideCard
          title="What this does"
          body="Recovery keeps your escape hatch visible: a recovery kit, receipts, and CLI commands that work from your own machine."
        />
        <GuideCard
          title="How to use it"
          body="Initialize the vault, save recovery-kit.json, save receipt.json after uploads, then run the CLI commands locally."
        />
        <GuideCard
          title="Security checklist"
          body="Do not paste private keys into this website. Do not share recovery-kit.json. Keep receipts with your backups."
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <VaultSetupPanel />

        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-2xl font-semibold text-foreground">Recovery steps</h2>
          <ol className="mt-5 space-y-4 text-sm text-muted">
            <RecoveryStep
              title="1. Save recovery-kit.json"
              body="This is where the key comes from. The CLI reads the file locally, so users do not paste key text into commands."
            />
            <RecoveryStep
              title="2. Save receipt.json"
              body="A receipt identifies the encrypted file, its restore route, and verification data."
            />
            <RecoveryStep
              title="3. Test restore with CLI"
              body="Run the commands below with a small test file before relying on the workflow for important data."
            />
          </ol>
          <Link
            href="/app/setup"
            className="mt-6 flex min-h-11 items-center justify-center rounded border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary"
          >
            Open Setup Wizard
          </Link>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-2xl font-semibold text-foreground">CLI commands</h2>
        <p className="mt-2 text-sm text-muted">
          Copy one command at a time. Replace paths with files on your own machine.
        </p>
        <div className="mt-5 space-y-5">
          {recoveryCommands.map((item) => (
            <article key={item.title} className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
              <CopyCommand command={item.command} label={item.label} />
              <p className="text-sm text-muted">{item.helper}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-2xl font-semibold text-foreground">Where values come from</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <ValueCard
            value="./recovery-kit.json"
            body="Download or export this from Recovery. Store it outside the web app."
          />
          <ValueCard
            value="./receipt.json"
            body="Export this after upload or pack verification. Keep a receipt per restored file."
          />
          <ValueCard
            value="<file-id>"
            body="Find this in receipt.json or by running the files list command."
          />
          <ValueCard
            value="./restored"
            body="This is just an output folder. You can change it to a path such as D:\\RestoredFiles."
          />
        </div>
      </section>
    </section>
  );
}

function GuideCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
    </article>
  );
}

function RecoveryStep({ title, body }: { title: string; body: string }) {
  return (
    <li className="rounded-lg border border-border bg-background p-4">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-2 leading-relaxed">{body}</p>
    </li>
  );
}

function ValueCard({ value, body }: { value: string; body: string }) {
  return (
    <article className="rounded-lg border border-border bg-background p-4">
      <h3 className="font-mono text-sm text-primary">{value}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </article>
  );
}
