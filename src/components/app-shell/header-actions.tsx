"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Bell, Settings } from "lucide-react";
import { ConnectedWalletBadge } from "./connected-wallet-badge";

type OpenDialog = "notifications" | "settings" | null;

export function HeaderActions() {
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);

  return (
    <div className="flex items-center gap-4">
      <ConnectedWalletBadge />
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpenDialog("notifications")}
        className="min-h-11 min-w-11 text-muted transition-colors hover:text-primary"
      >
        <Bell aria-hidden className="mx-auto h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="Settings"
        onClick={() => setOpenDialog("settings")}
        className="min-h-11 min-w-11 text-muted transition-colors hover:text-primary"
      >
        <Settings aria-hidden className="mx-auto h-5 w-5" />
      </button>

      {openDialog === "notifications" ? (
        <HeaderDialog
          title="Notifications"
          closeLabel="Close notifications"
          onClose={() => setOpenDialog(null)}
        >
          <p className="font-semibold text-foreground">No notifications yet</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Pack expiration alerts, upload failures, and storage registration
            updates will appear here when a live worker reports them.
          </p>
        </HeaderDialog>
      ) : null}

      {openDialog === "settings" ? (
        <HeaderDialog
          title="Workspace settings"
          closeLabel="Close settings"
          onClose={() => setOpenDialog(null)}
        >
          <dl className="space-y-3 text-sm">
            <SettingRow label="Network" value="Aptos Testnet" />
            <SettingRow label="Privacy mode" value="Client-side encryption" />
            <SettingRow label="Recovery" value="Local CLI only" />
          </dl>
        </HeaderDialog>
      ) : null}
    </div>
  );
}

function HeaderDialog({
  children,
  closeLabel,
  onClose,
  title,
}: {
  children: ReactNode;
  closeLabel: string;
  onClose: () => void;
  title: string;
}) {
  const titleId = `header-dialog-${title.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 px-4 pt-14 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 text-left shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-xl font-semibold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1 text-sm font-semibold text-muted transition-colors hover:text-foreground"
          >
            Close
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-strong">
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-foreground">{value}</dd>
    </div>
  );
}
