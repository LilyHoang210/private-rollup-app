"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Coins, LockKeyhole, WalletCards } from "lucide-react";
import {
  formatCredits,
  getCreditAccount,
  type CreditAccountResponse,
} from "@/client/api/credits";

type CreditBalanceState =
  | { kind: "loading" }
  | { kind: "ready"; account: CreditAccountResponse }
  | { kind: "failed" };

export function CreditBalancePanel() {
  const [state, setState] = useState<CreditBalanceState>({ kind: "loading" });

  useEffect(() => {
    let active = true;

    function loadCredits() {
      setState({ kind: "loading" });
      void getCreditAccount()
      .then(({ account }) => {
        if (active) {
          setState({ kind: "ready", account });
        }
      })
      .catch(() => {
        if (active) {
          setState({ kind: "failed" });
        }
      });
    }

    loadCredits();
    window.addEventListener("private-rollup:session-authenticated", loadCredits);

    return () => {
      active = false;
      window.removeEventListener("private-rollup:session-authenticated", loadCredits);
    };
  }, []);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="border-b border-border bg-surface-low p-6">
        <p className="font-mono text-xs uppercase tracking-wider text-primary">
          Prepaid settlement
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">
          Credit Balance
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Credits are reserved when encrypted files enter the queue. When a
          shared pack closes, the final cost is split by ciphertext bytes.
        </p>
      </div>

      {state.kind === "loading" ? (
        <div className="p-6 text-sm text-muted">Loading credit balance...</div>
      ) : null}

      {state.kind === "failed" ? (
        <div className="p-6 text-sm text-muted">
          Connect wallet to load credits. Credit accounts are wallet-scoped.
        </div>
      ) : null}

      {state.kind === "ready" ? (
        <div className="grid gap-3 p-6">
          <CreditRow
            icon={<WalletCards aria-hidden className="h-4 w-4" />}
            label="Total balance"
            value={formatCredits(state.account.balanceMicrocredits)}
          />
          <CreditRow
            icon={<Coins aria-hidden className="h-4 w-4" />}
            label="Available"
            value={formatCredits(state.account.availableMicrocredits)}
          />
          <CreditRow
            icon={<LockKeyhole aria-hidden className="h-4 w-4" />}
            label="Reserved"
            value={formatCredits(state.account.reservedMicrocredits)}
          />
          <p className="mt-2 rounded-lg border border-border bg-background p-3 text-xs leading-relaxed text-muted">
            Testnet credits are internal accounting units for this control
            plane. Real token deposits and refunds are not connected yet.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function CreditRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-strong">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <span className="font-mono text-sm text-foreground">{value}</span>
    </div>
  );
}
