import Link from "next/link";
import { CopyCommand } from "@/components/copy-command";

const cliCommands = [
  {
    title: "Import recovery kit",
    label: "import recovery kit command",
    command: "private-rollup recovery import ./recovery-kit.json",
    description:
      "./recovery-kit.json is the recovery kit file saved from Recovery. The CLI reads the file locally; do not paste private keys into the website or command.",
  },
  {
    title: "List files from receipts",
    label: "list receipts command",
    command: "private-rollup files list --receipts ./receipts",
    description:
      "./receipts is a local folder containing receipt.json files exported after uploads or pack verification.",
  },
  {
    title: "Restore one file",
    label: "restore one file command",
    command:
      "private-rollup files pull <file-id> --receipt ./receipt.json --output ./restored",
    description:
      "Replace <file-id> with the ID shown by the list command or inside receipt.json. ./restored is the output folder on your machine.",
  },
];

const featureGuides = [
  {
    name: "Setup Wizard",
    href: "/app/setup",
    what: "Explains the safe first-run flow before important uploads.",
    how: "Open it once, move step by step, copy the CLI commands, and confirm you know where recovery files live.",
    security:
      "Use it to learn the rules, but do not treat the website as the only recovery path.",
  },
  {
    name: "File Upload",
    href: "/app/upload",
    what: "Encrypts selected files locally and queues encrypted metadata for shared or dedicated blob packs.",
    how: "Choose files, add a private label, pick a file type, select retention, then queue the encrypted upload.",
    security:
      "Plaintext bytes should stay in your browser. Save the receipt before deleting the original file.",
  },
  {
    name: "Blob Packs",
    href: "/app/packs",
    what: "Shows shared or dedicated storage packages, expiration windows, and participation status.",
    how: "Review pack status and act before expiration warnings become urgent.",
    security:
      "Retention is operational. Keep recovery kit and receipts even if the dashboard looks healthy.",
  },
  {
    name: "Recovery",
    href: "/app/recovery",
    what: "Keeps local CLI recovery visible so files can be restored without relying on the website.",
    how: "Initialize vault material, save recovery-kit.json, save receipts, then run CLI restore commands locally.",
    security:
      "Do not paste private keys into web forms. The CLI should read recovery-kit.json from your machine.",
  },
];

const placeholderRows = [
  {
    value: "./recovery-kit.json",
    meaning: "Path to the recovery kit file saved from Recovery.",
    example: "D:\\PrivateRollup\\recovery-kit.json",
  },
  {
    value: "./receipts",
    meaning: "Folder containing receipt files from uploads.",
    example: "D:\\PrivateRollup\\receipts",
  },
  {
    value: "./receipt.json",
    meaning: "The specific receipt for the file you want to restore.",
    example: "D:\\PrivateRollup\\receipts\\family-photo.receipt.json",
  },
  {
    value: "<file-id>",
    meaning: "The file ID from the receipt or from the files list command.",
    example: "file_01HZX_PRIVATE",
  },
  {
    value: "./restored",
    meaning: "Folder where the CLI writes the restored file.",
    example: "D:\\RestoredFiles",
  },
];

export default function DocumentationPage() {
  return (
    <section className="mx-auto max-w-[1440px] space-y-8">
      <div>
        <p className="font-mono text-sm uppercase tracking-wider text-primary">
          User guide
        </p>
        <h1 className="mt-2 text-5xl font-bold leading-tight text-foreground">
          Documentation
        </h1>
        <p className="mt-3 max-w-3xl text-muted">
          A practical guide for non-technical users: what each feature does, how
          to use it, and how to keep encrypted recovery under your control.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <IntroCard
          title="What this product does"
          body="It helps upload encrypted files into shared blob packs while keeping plaintext and recovery secrets out of the server."
        />
        <IntroCard
          title="How you should use it"
          body="Start with the wizard, upload a small test file, save the recovery kit and receipt, then practice a CLI restore."
        />
        <IntroCard
          title="Security checklist"
          body="Do not paste private keys. Keep recovery-kit.json offline. Store receipts in at least two places."
        />
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-2xl font-semibold text-foreground">Start here</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <DocLink href="/app/setup" label="Open Setup Wizard" />
          <DocLink href="/app/upload" label="Open File Upload" />
          <DocLink href="/app/packs" label="Open Blob Packs" />
          <DocLink href="/app/recovery" label="Open Recovery" />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-2xl font-semibold text-foreground">Feature guide</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {featureGuides.map((feature) => (
            <article key={feature.name} className="rounded-xl border border-border bg-background p-5">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-xl font-semibold text-foreground">{feature.name}</h3>
                <Link
                  href={feature.href}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Open
                </Link>
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <GuideRow label="What this does" value={feature.what} />
                <GuideRow label="How to use it" value={feature.how} />
                <GuideRow label="Security checklist" value={feature.security} />
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-2xl font-semibold text-foreground">CLI recovery commands</h2>
        <p className="mt-2 max-w-3xl text-muted">
          Copy one command at a time. The CLI uses file paths on your machine.
          You should not paste private key text into the website or terminal.
        </p>
        <div className="mt-5 space-y-5">
          {cliCommands.map((item) => (
            <article key={item.title} className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
              <CopyCommand command={item.command} label={item.label} />
              <p className="text-sm text-muted">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-2xl font-semibold text-foreground">Replace these values</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <TableHead>Value in command</TableHead>
                <TableHead>What it means</TableHead>
                <TableHead>Example</TableHead>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {placeholderRows.map((row) => (
                <tr key={row.value}>
                  <td className="px-4 py-3 font-mono text-primary">{row.value}</td>
                  <td className="px-4 py-3 text-muted">{row.meaning}</td>
                  <td className="px-4 py-3 font-mono text-muted">{row.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <FAQ
          question="Where do I get the key?"
          answer="You do not copy a raw key into a command. You save recovery-kit.json from Recovery, then the CLI reads that file locally."
        />
        <FAQ
          question="Where do I get receipt.json?"
          answer="Each upload should produce or export a receipt. Keep it with your backups because it identifies the encrypted file and restore route."
        />
        <FAQ
          question="What if the website is offline?"
          answer="Use the CLI with recovery-kit.json and receipt.json. That is why recovery files must be saved outside the web app."
        />
        <FAQ
          question="What should I never share?"
          answer="Do not share recovery-kit.json, private keys, recovery phrases, or plaintext files with support or other users."
        />
      </section>
    </section>
  );
}

function IntroCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
    </article>
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

function GuideRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-foreground">{label}</dt>
      <dd className="mt-1 leading-relaxed text-muted">{value}</dd>
    </div>
  );
}

function TableHead({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-semibold uppercase text-muted-strong">{children}</th>;
}

function FAQ({ question, answer }: { question: string; answer: string }) {
  return (
    <article className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold text-foreground">{question}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">{answer}</p>
    </article>
  );
}
