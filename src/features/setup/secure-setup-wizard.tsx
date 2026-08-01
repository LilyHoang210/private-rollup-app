"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  FileKey2,
  FileText,
  LockKeyhole,
  ShieldCheck,
  Terminal,
  UploadCloud,
} from "lucide-react";
import { CopyCommand } from "@/components/copy-command";

type StepId = "protect" | "vault" | "upload" | "recovery" | "cli" | "finish";

interface WizardStep {
  id: StepId;
  title: string;
  icon: typeof ShieldCheck;
  whatThisDoes: string[];
  howToUseIt: string[];
  securityChecklist: string[];
}

const wizardSteps: WizardStep[] = [
  {
    id: "protect",
    title: "What this protects",
    icon: ShieldCheck,
    whatThisDoes: [
      "Private Rollup helps you upload files without giving the web service your plaintext files.",
      "The browser prepares encrypted metadata, wrapped file keys, and receipts that can later prove how to restore data.",
    ],
    howToUseIt: [
      "Use this wizard once before your first important upload.",
      "Read each step, save the recovery files, then run a small CLI restore test before trusting the workflow.",
    ],
    securityChecklist: [
      "Treat the recovery kit like a house key for your encrypted files.",
      "Keep receipts with your backups because they tell the CLI what file and byte range to restore.",
      "Do not rely on the website as your only recovery path.",
    ],
  },
  {
    id: "vault",
    title: "Create your vault",
    icon: LockKeyhole,
    whatThisDoes: [
      "The vault public key lets the browser wrap each file key before upload.",
      "The server can store public vault material, but it must not receive your private recovery key.",
    ],
    howToUseIt: [
      "Open Recovery and initialize the vault before uploading important files.",
      "Download the recovery kit when export is available and store it outside this web app.",
    ],
    securityChecklist: [
      "Do not paste a private key into this website.",
      "Do not send the recovery kit through chat, email, or support tickets.",
      "Store one copy offline, such as an encrypted USB drive or offline password manager.",
    ],
  },
  {
    id: "upload",
    title: "Upload a test file",
    icon: UploadCloud,
    whatThisDoes: [
      "File Upload encrypts selected files locally and sends only encrypted metadata to the control plane.",
      "Small encrypted files can later be grouped into shared blob packs to reduce storage overhead.",
    ],
    howToUseIt: [
      "Start with a small non-sensitive test file so you can learn the restore flow safely.",
      "Add a private label and file type label so your future receipts are easier to identify.",
    ],
    securityChecklist: [
      "Plaintext file bytes stay in your browser session.",
      "The web app should not ask you to upload a raw private key or recovery phrase.",
      "After upload, save the receipt before deleting your local original.",
    ],
  },
  {
    id: "recovery",
    title: "Save recovery files",
    icon: FileKey2,
    whatThisDoes: [
      "The recovery kit is the file the CLI reads locally when it needs your recovery key material.",
      "A receipt is the file-specific proof and routing data needed to find and verify your encrypted bytes.",
    ],
    howToUseIt: [
      "Save recovery-kit.json in a private folder that is not synced to an unsafe shared account.",
      "Save each receipt.json with your normal backups, preferably in at least two places.",
    ],
    securityChecklist: [
      "If you lose the recovery kit, the service should not be able to decrypt files for you.",
      "If you lose receipts, finding the exact file inside blob packs can become difficult.",
      "Never share recovery-kit.json with support. Share only error messages and non-secret IDs.",
    ],
  },
  {
    id: "cli",
    title: "Practice CLI restore",
    icon: Terminal,
    whatThisDoes: [
      "The CLI is the escape hatch when the website is unavailable or you want local-only recovery.",
      "Commands read local files from your machine instead of asking you to paste keys into the browser.",
    ],
    howToUseIt: [
      "Place recovery-kit.json and receipt.json in a local folder.",
      "Run the import command, list files from receipts, then pull one file into a restored folder.",
    ],
    securityChecklist: [
      "Replace <file-id> with the ID shown by the files list command or inside the receipt.",
      "Use a local output path you control, for example ./restored or D:\\RestoredFiles.",
      "Do not paste private keys into terminal history. Pass file paths instead.",
    ],
  },
  {
    id: "finish",
    title: "Finish setup",
    icon: CheckCircle2,
    whatThisDoes: [
      "This step confirms the minimum safe workflow: vault ready, test upload understood, recovery files saved, CLI restore practiced.",
      "After this, use Dashboard for monitoring and File Upload for regular encrypted uploads.",
    ],
    howToUseIt: [
      "Go to Dashboard for pack status and expiration alerts.",
      "Return to this wizard whenever you need to explain the workflow to another user.",
    ],
    securityChecklist: [
      "Keep recovery files private and backed up.",
      "Review expiring packs before the retention window ends.",
      "Test restore periodically, not only during an emergency.",
    ],
  },
];

const cliCommands = [
  {
    label: "import recovery kit command",
    title: "1. Import the recovery kit",
    command: "private-rollup recovery import ./recovery-kit.json",
    help: "./recovery-kit.json is the file you save from the Recovery page. The CLI reads it locally; you do not paste key text into the command.",
  },
  {
    label: "list receipts command",
    title: "2. List files from receipts",
    command: "private-rollup files list --receipts ./receipts",
    help: "./receipts is a local folder that contains one or more receipt.json files exported after upload.",
  },
  {
    label: "restore one file command",
    title: "3. Restore one file",
    command:
      "private-rollup files pull <file-id> --receipt ./receipt.json --output ./restored",
    help: "Replace <file-id> with the ID shown by the list command. ./receipt.json is the receipt for that file. ./restored is the output folder.",
  },
];

export function SecureSetupWizard({ initialStepId }: { initialStepId?: StepId }) {
  const initialIndex = Math.max(
    wizardSteps.findIndex((step) => step.id === initialStepId),
    0,
  );
  const [stepIndex, setStepIndex] = useState(initialIndex);
  const step = wizardSteps[stepIndex];
  const Icon = step.icon;
  const nextStep = wizardSteps[stepIndex + 1];
  const progressWidth = useMemo(
    () => `${((stepIndex + 1) / wizardSteps.length) * 100}%`,
    [stepIndex],
  );

  return (
    <section className="mx-auto max-w-[1440px] space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-sm uppercase tracking-wider text-primary">
            First secure upload
          </p>
          <h1 className="mt-2 text-5xl font-bold leading-tight text-foreground">
            Secure Setup Wizard
          </h1>
          <p className="mt-3 max-w-3xl text-muted">
            Follow this guided setup before trusting the app with important files.
            Each step explains what the feature does, how to use it, and how to keep
            the recovery path secure.
          </p>
        </div>
        <Link
          href="/app"
          className="flex min-h-11 items-center justify-center rounded border border-border bg-surface px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-primary hover:text-foreground"
        >
          Skip for now
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-sm text-primary">
            Step {stepIndex + 1} of {wizardSteps.length}
          </p>
          <p className="hidden text-sm text-muted md:block">{step.title}</p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-background">
          <div className="h-full rounded-full bg-primary" style={{ width: progressWidth }} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <aside className="rounded-xl border border-border bg-surface p-4">
          <ol className="space-y-2">
            {wizardSteps.map((item, index) => {
              const StepIcon = item.icon;
              const active = item.id === step.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setStepIndex(index)}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold transition-colors ${
                      active
                        ? "bg-surface-highest text-foreground"
                        : "text-muted hover:bg-surface-high hover:text-foreground"
                    }`}
                  >
                    <StepIcon aria-hidden className="h-4 w-4 text-primary" />
                    {item.title}
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <article className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-surface-high text-primary">
              <Icon aria-hidden className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-3xl font-semibold text-foreground">{step.title}</h2>
              <p className="mt-2 text-muted">
                Read this before moving on. Security depends on both the software and
                how recovery files are handled.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <GuidanceCard title="What this does" items={step.whatThisDoes} />
            <GuidanceCard title="How to use it" items={step.howToUseIt} />
            <GuidanceCard title="Security checklist" items={step.securityChecklist} />
          </div>

          {step.id === "cli" ? (
            <section className="mt-6 space-y-4 rounded-xl border border-border bg-surface-high p-5">
              <h3 className="text-xl font-semibold text-foreground">Copy commands</h3>
              <p className="text-sm text-muted">
                These commands use file paths. They do not require you to paste private
                key text into the browser or terminal.
              </p>
              {cliCommands.map((command) => (
                <div key={command.title} className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">{command.title}</h4>
                  <CopyCommand command={command.command} label={command.label} />
                  <p className="text-sm text-muted">{command.help}</p>
                </div>
              ))}
              <div className="rounded-lg border border-primary/40 bg-background p-4 text-sm text-muted">
                Replace &lt;file-id&gt; with the ID shown by the list command or inside
                receipt.json.
              </div>
            </section>
          ) : null}

          {step.id === "finish" ? (
            <section className="mt-6 grid gap-3 md:grid-cols-3">
              <WizardLink href="/app" label="Go to Dashboard" />
              <WizardLink href="/app/upload" label="Upload Files" />
              <WizardLink href="/app/documentation" label="Read Documentation" />
            </section>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <button
              type="button"
              onClick={() => setStepIndex((current) => Math.max(current - 1, 0))}
              disabled={stepIndex === 0}
              className="min-h-11 rounded border border-border bg-background px-5 py-2 text-sm font-semibold text-muted transition-colors hover:border-primary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>
            {nextStep ? (
              <button
                type="button"
                onClick={() =>
                  setStepIndex((current) =>
                    Math.min(current + 1, wizardSteps.length - 1),
                  )
                }
                className="min-h-11 rounded bg-primary px-5 py-2 text-sm font-semibold text-[#133155] transition-opacity hover:opacity-90"
              >
                Next: {nextStep.title}
              </button>
            ) : (
              <Link
                href="/app"
                className="flex min-h-11 items-center justify-center rounded bg-primary px-5 py-2 text-sm font-semibold text-[#133155] transition-opacity hover:opacity-90"
              >
                Go to Dashboard
              </Link>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

function GuidanceCard({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-xl border border-border bg-background p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground">
        <FileText aria-hidden className="h-4 w-4 text-primary" />
        {title}
      </h3>
      <ul className="mt-4 space-y-3 text-sm text-muted">
        {items.map((item) => (
          <li key={item} className="leading-relaxed">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function WizardLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center justify-center rounded border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary"
    >
      {label}
    </Link>
  );
}
