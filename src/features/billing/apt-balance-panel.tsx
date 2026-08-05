"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpFromLine, ExternalLink, LockKeyhole, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { formatApt } from "@/domain/apt";
import { parseAptToOctas } from "@/domain/apt";
import {
  buildWithdrawRefundPayload,
  getPaymentVaultStatus,
  type PaymentVaultStatusResponse,
} from "@/client/api/payment-vault";

type VaultState =
  | { kind: "loading" }
  | { kind: "ready"; status: PaymentVaultStatusResponse }
  | { kind: "failed"; message: string };

export function AptBalancePanel() {
  const { connected, signAndSubmitTransaction } = useWallet();
  const [state, setState] = useState<VaultState>({ kind: "loading" });
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<"refresh" | "withdraw" | null>(null);
  const [notice, setNotice] = useState<string>();

  const loadStatus = () => {
    setBusy((current) => current ?? "refresh");
    void getPaymentVaultStatus()
      .then((status) => {
        setState({ kind: "ready", status });
      })
      .catch((error: unknown) => {
        setState({
          kind: "failed",
          message: userFacingErrorMessage(error, "Payment Vault status is unavailable"),
        });
      })
      .finally(() => setBusy(null));
  };

  useEffect(() => {
    queueMicrotask(loadStatus);
    window.addEventListener("private-rollup:session-authenticated", loadStatus);
    return () => {
      window.removeEventListener("private-rollup:session-authenticated", loadStatus);
    };
  }, []);

  async function withdrawRefund() {
    if (state.kind !== "ready" || !state.status.contractAddress || !connected) return;
    setBusy("withdraw");
    setNotice(undefined);
    try {
      const amountOctas = parseAptToOctas(amount);
      if (amountOctas <= 0) throw new Error("Enter an amount greater than zero");
      if (amountOctas > state.status.refundableOctas) {
        throw new Error("Amount is greater than your refundable Payment Vault balance");
      }

      const result = await signAndSubmitTransaction(
        buildWithdrawRefundPayload({
          contractAddress: state.status.contractAddress,
          amountOctas,
        }),
      );
      setNotice(`Refund withdrawal submitted: ${shortHash(extractTransactionHash(result))}`);
      setAmount("");
      loadStatus();
    } catch (error) {
      setNotice(userFacingErrorMessage(error, "Refund withdrawal failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="border-b border-border bg-surface-low p-6">
        <p className="font-mono text-xs uppercase tracking-wider text-primary">
          Payment Vault | Shelbynet
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">Payment Vault</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Your connected wallet pays each upload into the Payment Vault contract.
          The contract pays Shelby, releases the platform fee only after success,
          and keeps failed or unused amounts refundable to your wallet.
        </p>
      </div>

      {state.kind === "loading" ? (
        <div className="p-6 text-sm text-muted">Loading Payment Vault status...</div>
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
                <p className="text-sm font-semibold text-foreground">Payment Vault contract</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  This contract is the payment wallet for uploads. The backend can
                  coordinate upload status, but it cannot withdraw user refunds.
                </p>
                <code className="mt-3 block break-all rounded bg-surface-high p-3 text-xs text-primary">
                  {state.status.contractAddress || "Not configured"}
                </code>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={loadStatus}
                    disabled={busy !== null}
                    className="inline-flex min-h-10 items-center gap-2 rounded border border-border bg-surface px-3 text-xs font-semibold text-foreground hover:border-primary disabled:opacity-60"
                  >
                    <RefreshCw className={`h-4 w-4 ${busy === "refresh" ? "animate-spin" : ""}`} />
                    Refresh vault status
                  </button>
                  {state.status.contractAddress ? (
                    <a
                      href={`https://explorer.aptoslabs.com/account/${state.status.contractAddress}?network=testnet`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center gap-2 rounded border border-border bg-surface px-3 text-xs font-semibold text-foreground hover:border-primary"
                    >
                      <ExternalLink className="h-4 w-4" /> View contract
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <BalanceRow
              icon={<LockKeyhole className="h-4 w-4" />}
              label="Reserved for pending uploads"
              value={formatApt(state.status.reservedOctas)}
            />
            <BalanceRow
              icon={<WalletCards className="h-4 w-4" />}
              label="Refundable"
              value={formatApt(state.status.refundableOctas)}
            />
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-sm font-semibold text-foreground">Withdraw refundable APT</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Refunds are withdrawn by your connected wallet directly from the
              Payment Vault. The website prepares the transaction; your wallet signs it.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <label className="min-w-0 flex-1">
                <span className="sr-only">APT amount to withdraw from Payment Vault</span>
                <input
                  aria-label="APT amount to withdraw from Payment Vault"
                  value={amount}
                  onChange={(event) => setAmount(event.currentTarget.value)}
                  inputMode="decimal"
                  placeholder="Amount in APT"
                  className="min-h-11 w-full rounded border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
              <button
                type="button"
                onClick={() => setAmount(octasToInput(state.status.refundableOctas))}
                disabled={state.status.refundableOctas === 0 || busy !== null}
                className="min-h-11 rounded border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:border-primary disabled:opacity-50"
              >
                Use maximum
              </button>
              <button
                type="button"
                onClick={withdrawRefund}
                disabled={!connected || !amount || busy !== null || !state.status.contractAddress}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded bg-primary px-4 text-sm font-semibold text-[#133155] disabled:opacity-50"
              >
                <ArrowUpFromLine className="h-4 w-4" />
                {busy === "withdraw" ? "Waiting for wallet..." : "Withdraw refund"}
              </button>
            </div>
          </div>

          <section className="rounded-lg border border-border bg-background p-4">
            <h3 className="text-sm font-semibold text-foreground">Recent vault requests</h3>
            {state.status.reservations.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                No Payment Vault reservations are indexed for this wallet yet.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {state.status.reservations.slice(0, 5).map((request) => (
                  <div
                    key={request.requestId}
                    className="grid gap-2 rounded border border-border bg-surface p-3 text-sm md:grid-cols-[1fr_auto_auto]"
                  >
                    <span className="font-mono text-primary">{request.requestId}</span>
                    <span className="font-semibold text-foreground">{statusLabel(request.status)}</span>
                    <span className="font-mono text-muted">
                      {formatApt(request.refundableOctas)} refundable
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

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

export function userFacingErrorMessage(error: unknown, fallback = "Request failed") {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }
  return fallback;
}

function extractTransactionHash(result: unknown) {
  if (
    typeof result === "object" &&
    result !== null &&
    "hash" in result &&
    typeof result.hash === "string" &&
    /^0x[a-fA-F0-9]+$/.test(result.hash)
  ) {
    return result.hash;
  }
  throw new Error("Wallet did not return a transaction hash");
}

function octasToInput(octas: number) {
  return (octas / 100_000_000).toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
}

function shortHash(value: string) {
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function statusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
