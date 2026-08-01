"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpFromLine,
  Check,
  Coins,
  Copy,
  ExternalLink,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { parseAptToOctas } from "@/domain/apt";
import {
  formatApt,
  getAptAccount,
  syncAptDeposits,
  withdrawAvailableApt,
  type AptAccountResponse,
} from "@/client/api/apt-account";

type AccountState =
  | { kind: "loading" }
  | { kind: "ready"; account: AptAccountResponse }
  | { kind: "failed"; message: string };

export function AptBalancePanel() {
  const [state, setState] = useState<AccountState>({ kind: "loading" });
  const [busy, setBusy] = useState<"sync" | "withdraw" | null>(null);
  const [amount, setAmount] = useState("");
  const [notice, setNotice] = useState<string>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    const loadAccount = () => {
      void getAptAccount()
        .then(({ account }) => {
          if (active) setState({ kind: "ready", account });
        })
        .catch((error: unknown) => {
          if (active) {
            setState({
              kind: "failed",
              message:
                error instanceof Error ? error.message : "APT account is unavailable",
            });
          }
        });
    };
    loadAccount();
    window.addEventListener("private-rollup:session-authenticated", loadAccount);
    return () => {
      active = false;
      window.removeEventListener("private-rollup:session-authenticated", loadAccount);
    };
  }, []);

  async function syncDeposits() {
    setBusy("sync");
    setNotice(undefined);
    try {
      const { account } = await syncAptDeposits();
      setState({ kind: "ready", account });
      setNotice("On-chain APT balance synced successfully.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "APT sync failed");
    } finally {
      setBusy(null);
    }
  }

  async function withdraw() {
    if (state.kind !== "ready") return;
    setBusy("withdraw");
    setNotice(undefined);
    try {
      const amountOctas = parseAptToOctas(amount);
      if (amountOctas <= 0) throw new Error("Enter an amount greater than zero");
      const result = await withdrawAvailableApt({
        amountOctas,
        idempotencyKey: crypto.randomUUID(),
      });
      setState({ kind: "ready", account: result.account });
      setAmount("");
      setNotice(`Withdrawal confirmed: ${shortHash(result.transactionHash)}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "APT withdrawal failed");
    } finally {
      setBusy(null);
    }
  }

  async function copyAddress(address: string) {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="border-b border-border bg-surface-low p-6">
        <p className="font-mono text-xs uppercase tracking-wider text-primary">
          Real APT | Aptos Testnet
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">Service wallet</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          This is real Testnet APT held in a wallet created only for your account.
          Unused APT remains withdrawable; the displayed balance is backed by this wallet.
        </p>
      </div>

      {state.kind === "loading" ? (
        <div className="p-6 text-sm text-muted">Creating and syncing your APT wallet...</div>
      ) : null}
      {state.kind === "failed" ? (
        <div className="p-6 text-sm text-error">{state.message}</div>
      ) : null}

      {state.kind === "ready" ? (
        <div className="space-y-5 p-6">
          <div className="rounded-lg border border-primary/35 bg-background p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Your APT deposit address</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Send only Aptos Testnet APT to this address. The server encrypts its
                  signing key at rest and uses it only for pack payment and withdrawals.
                </p>
                <code className="mt-3 block break-all rounded bg-surface-high p-3 text-xs text-primary">
                  {state.account.wallet.address}
                </code>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyAddress(state.account.wallet.address)}
                    className="inline-flex min-h-10 items-center gap-2 rounded border border-border bg-surface px-3 text-xs font-semibold text-foreground hover:border-primary"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy address"}
                  </button>
                  <a
                    href={`https://explorer.aptoslabs.com/account/${state.account.wallet.address}?network=testnet`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center gap-2 rounded border border-border bg-surface px-3 text-xs font-semibold text-foreground hover:border-primary"
                  >
                    <ExternalLink className="h-4 w-4" /> View on explorer
                  </a>
                  <button
                    type="button"
                    onClick={syncDeposits}
                    disabled={busy !== null}
                    className="inline-flex min-h-10 items-center gap-2 rounded border border-border bg-surface px-3 text-xs font-semibold text-foreground hover:border-primary disabled:opacity-60"
                  >
                    <RefreshCw className={`h-4 w-4 ${busy === "sync" ? "animate-spin" : ""}`} />
                    I have deposited - sync
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <BalanceRow icon={<WalletCards className="h-4 w-4" />} label="Usable APT balance" value={formatApt(state.account.balanceOctas)} />
            <BalanceRow icon={<Coins className="h-4 w-4" />} label="Available to withdraw" value={formatApt(state.account.availableOctas)} />
            <BalanceRow icon={<LockKeyhole className="h-4 w-4" />} label="Reserved for open packs" value={formatApt(state.account.reservedOctas)} />
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-sm font-semibold text-foreground">Withdraw to your connected wallet</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              You may withdraw any available amount at any time. APT reserved for an
              open pack unlocks when that pack settles or the upload is cancelled.
              The service sponsors withdrawal gas, so the requested amount is not reduced by gas.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <label className="min-w-0 flex-1">
                <span className="sr-only">APT amount to withdraw</span>
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.currentTarget.value)}
                  inputMode="decimal"
                  placeholder="Amount in APT"
                  className="min-h-11 w-full rounded border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
              <button
                type="button"
                onClick={() => setAmount(octasToInput(state.account.availableOctas))}
                disabled={state.account.availableOctas === 0 || busy !== null}
                className="min-h-11 rounded border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:border-primary disabled:opacity-50"
              >
                Use maximum
              </button>
              <button
                type="button"
                onClick={withdraw}
                disabled={!amount || busy !== null}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded bg-primary px-4 text-sm font-semibold text-[#133155] disabled:opacity-50"
              >
                <ArrowUpFromLine className="h-4 w-4" />
                {busy === "withdraw" ? "Withdrawing..." : "Withdraw APT"}
              </button>
            </div>
          </div>

          {notice ? (
            <p aria-live="polite" className="rounded-lg border border-border bg-surface-high p-3 text-xs text-muted-strong">
              {notice}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function BalanceRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-strong">
        <span className="text-primary">{icon}</span>{label}
      </div>
      <span className="font-mono text-sm text-foreground">{value}</span>
    </div>
  );
}

function octasToInput(octas: number) {
  return (octas / 100_000_000).toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
}

function shortHash(value: string) {
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}
