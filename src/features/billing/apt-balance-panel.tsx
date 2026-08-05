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
import { DIRECT_WITHDRAWAL_GAS_BUFFER_OCTAS, parseAptToOctas } from "@/domain/apt";
import {
  useWallet,
  type AptosSignAndSubmitTransactionOutput,
  type InputTransactionData,
} from "@aptos-labs/wallet-adapter-react";
import {
  formatApt,
  getAptAccount,
  syncAptDeposits,
  withdrawAvailableApt,
  type AptAccountResponse,
} from "@/client/api/apt-account";

const WALLET_RESPONSE_TIMEOUT_MS = 45_000;
const DEPOSIT_SYNC_ATTEMPTS = 6;
const DEPOSIT_SYNC_INTERVAL_MS = process.env.NODE_ENV === "test" ? 10 : 1200;

type AccountState =
  | { kind: "loading" }
  | { kind: "ready"; account: AptAccountResponse }
  | { kind: "failed"; message: string };

export function AptBalancePanel() {
  const { connected, signAndSubmitTransaction } = useWallet();
  const [state, setState] = useState<AccountState>({ kind: "loading" });
  const [busy, setBusy] = useState<"deposit" | "sync" | "withdraw" | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [amount, setAmount] = useState("");
  const [notice, setNotice] = useState<string>();
  const [lastSubmittedHash, setLastSubmittedHash] = useState<string>();
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
    setLastSubmittedHash(undefined);
    try {
      const { account } = await syncAptDeposits();
      setState({ kind: "ready", account });
      setNotice("On-chain APT balance synced successfully.");
    } catch (error) {
      setNotice(userFacingErrorMessage(error, "APT sync failed"));
    } finally {
      setBusy(null);
    }
  }

  async function deposit() {
    if (state.kind !== "ready" || !connected) return;
    setBusy("deposit");
    setNotice(undefined);
    setLastSubmittedHash(undefined);
    try {
      const amountOctas = parseAptToOctas(depositAmount);
      if (amountOctas <= 0) throw new Error("Enter an amount greater than zero");
      const submitted = await withWalletResponseTimeout(
        signAndSubmitTransaction(
          buildDepositTransaction({
            recipientAddress: state.account.wallet.address,
            amountOctas,
          }),
        ),
      );
      setLastSubmittedHash(submitted.hash);
      setNotice(`Deposit submitted: ${shortHash(submitted.hash)}. Syncing on-chain balance...`);
      const account = await waitForDeposit(state.account.balanceOctas);
      setState({ kind: "ready", account });
      setDepositAmount("");
      setNotice(`Deposit confirmed: ${shortHash(submitted.hash)}`);
    } catch (error) {
      setNotice(userFacingErrorMessage(error, "APT deposit failed"));
    } finally {
      setBusy(null);
    }
  }

  async function waitForDeposit(previousBalanceOctas: number) {
    let latest: AptAccountResponse | undefined;
    for (let attempt = 0; attempt < DEPOSIT_SYNC_ATTEMPTS; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, DEPOSIT_SYNC_INTERVAL_MS));
      }
      const result = await syncAptDeposits();
      latest = result.account;
      if (latest.balanceOctas > previousBalanceOctas) return latest;
    }
    if (!latest) throw new Error("Deposit was submitted but balance sync is unavailable");
    throw new Error(
      "The transaction was submitted, but the service wallet balance did not increase. Open the transaction in your wallet or explorer, then click 'I have deposited - sync' after it succeeds.",
    );
  }

  async function withdraw() {
    if (state.kind !== "ready") return;
    setBusy("withdraw");
    setNotice(undefined);
    setLastSubmittedHash(undefined);
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
      setNotice(userFacingErrorMessage(error, "APT withdrawal failed"));
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

          <div className="rounded-lg border border-primary/35 bg-background p-4">
            <p className="text-sm font-semibold text-foreground">Deposit from your connected wallet</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Enter an amount, approve one Aptos Testnet transfer in your wallet,
              and the app will sync it to your usable APT balance automatically.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <label className="min-w-0 flex-1">
                <span className="sr-only">APT amount to deposit</span>
                <input
                  value={depositAmount}
                  onChange={(event) => setDepositAmount(event.currentTarget.value)}
                  inputMode="decimal"
                  placeholder="Amount in APT"
                  className="min-h-11 w-full rounded border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
              <button
                type="button"
                onClick={deposit}
                disabled={!connected || !depositAmount || busy !== null}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded bg-primary px-4 text-sm font-semibold text-[#133155] disabled:opacity-50"
              >
                <WalletCards className="h-4 w-4" />
                {busy === "deposit" ? "Waiting for wallet..." : "Deposit APT"}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-sm font-semibold text-foreground">Withdraw to your connected wallet</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              You may withdraw any available amount at any time. APT reserved for an
              open pack unlocks when that pack settles or the upload is cancelled.
              Aptos network gas is paid from this service wallet, so keep a small
              gas buffer when withdrawing.
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
                onClick={() => setAmount(octasToInput(maxDirectWithdrawalOctas(state.account.availableOctas)))}
                disabled={maxDirectWithdrawalOctas(state.account.availableOctas) === 0 || busy !== null}
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

          {lastSubmittedHash ? (
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-sm font-semibold text-foreground">Submitted transaction</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                The wallet returned this transaction hash. Use the explorer link to
                verify whether Aptos accepted it, then sync the service wallet balance.
              </p>
              <code className="mt-3 block break-all rounded bg-surface-high p-3 text-xs text-primary">
                {lastSubmittedHash}
              </code>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyAddress(lastSubmittedHash)}
                  className="inline-flex min-h-10 items-center gap-2 rounded border border-border bg-surface px-3 text-xs font-semibold text-foreground hover:border-primary"
                >
                  <Copy className="h-4 w-4" /> Copy hash
                </button>
                <a
                  href={`https://explorer.aptoslabs.com/txn/${lastSubmittedHash}?network=testnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center gap-2 rounded border border-border bg-surface px-3 text-xs font-semibold text-foreground hover:border-primary"
                >
                  <ExternalLink className="h-4 w-4" /> View submitted transaction
                </a>
              </div>
            </div>
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

export function buildDepositTransaction(input: {
  recipientAddress: string;
  amountOctas: number;
}): InputTransactionData {
  return {
    data: {
      function: "0x1::aptos_account::transfer",
      functionArguments: [input.recipientAddress, input.amountOctas],
    },
  };
}

export async function withWalletResponseTimeout(
  promise: Promise<AptosSignAndSubmitTransactionOutput>,
  timeoutMs = WALLET_RESPONSE_TIMEOUT_MS,
) {
  let timeoutId: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(
            new Error(
              "Wallet did not return a transaction hash. If you approved the transfer, wait a few seconds and click 'I have deposited - sync'. If the balance stays unchanged, reopen your wallet and try again.",
            ),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
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

function octasToInput(octas: number) {
  return (octas / 100_000_000).toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
}

function maxDirectWithdrawalOctas(availableOctas: number) {
  return Math.max(0, availableOctas - DIRECT_WITHDRAWAL_GAS_BUFFER_OCTAS);
}

function shortHash(value: string) {
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}
