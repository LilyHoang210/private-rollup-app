"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyCommand({
  command,
  label,
}: {
  command: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyCommand() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <code className="overflow-x-auto whitespace-pre-wrap font-mono text-sm leading-relaxed text-primary">
          {command}
        </code>
        <button
          type="button"
          onClick={copyCommand}
          className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          aria-label={`Copy ${label}`}
        >
          {copied ? (
            <Check aria-hidden className="h-4 w-4 text-accent" />
          ) : (
            <Copy aria-hidden className="h-4 w-4" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
