"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { LogOut, Wallet } from "lucide-react";
import { getAptBalance } from "@/client/aptos/balance";
import { getWalletSession } from "@/client/api/auth";
import {
  authenticateConnectedWallet,
  isExtensionWallet,
  shortAddress,
  slugWalletName,
} from "@/features/auth/wallet-auth";

type WalletActionStatus = "idle" | "connecting" | "connected" | "failed" | "logging_out";
type HydratedSession =
  | { authenticated: false }
  | {
      authenticated: true;
      walletAddress?: string;
      walletAddressHash?: string;
      chainId: string;
      expiresAt: string;
    };
type BalanceState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; value: string }
  | { kind: "failed" };

export function ConnectedWalletBadge() {
  const {
    account,
    connect,
    connected,
    disconnect,
    isLoading,
    signMessage,
    wallet,
    wallets,
  } = useWallet();
  const [status, setStatus] = useState<WalletActionStatus>("idle");
  const [message, setMessage] = useState("");
  const [isPanelOpen, setPanelOpen] = useState(false);
  const [pendingWalletName, setPendingWalletName] = useState<string | null>(null);
  const [balanceState, setBalanceState] = useState<BalanceState>({ kind: "idle" });
  const [hydratedSession, setHydratedSession] = useState<HydratedSession>({
    authenticated: false,
  });
  const authStartedRef = useRef(false);
  const address = account?.address?.toString();
  const displayAddress =
    address ??
    (hydratedSession.authenticated ? hydratedSession.walletAddress : undefined);
  const hasActiveSession = Boolean(displayAddress || connected);
  const extensionWallets = wallets.filter(isExtensionWallet);
  const label = displayAddress
    ? shortAddress(displayAddress)
    : connected || isLoading
      ? "Wallet connected"
      : "Connect wallet";

  useEffect(() => {
    let active = true;

    void getWalletSession()
      .then((session) => {
        if (!active) {
          return;
        }
        setHydratedSession(
          session.authenticated === true
            ? {
                authenticated: true,
                chainId: session.chainId,
                walletAddress: session.walletAddress,
                walletAddressHash: session.walletAddressHash,
                expiresAt: session.expiresAt ?? "",
              }
            : { authenticated: false },
        );
      })
      .catch(() => {
        if (active) {
          setHydratedSession({ authenticated: false });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!pendingWalletName || !connected || !account || authStartedRef.current) {
      return;
    }

    authStartedRef.current = true;

    void (async () => {
      try {
        const { chainId } = await authenticateConnectedWallet({
          account,
          signMessage,
        });
        setHydratedSession({
          authenticated: true,
          chainId,
          walletAddress: address,
          expiresAt: "",
        });
        setStatus("connected");
        setPendingWalletName(null);
        setPanelOpen(false);
        setMessage(`Connected on ${chainId}.`);
      } catch (error) {
        authStartedRef.current = false;
        setStatus("failed");
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not verify the selected Aptos wallet.",
        );
      }
    })();
  }, [account, address, connected, pendingWalletName, signMessage]);

  useEffect(() => {
    if (!isPanelOpen || !displayAddress) {
      return;
    }

    let active = true;
    void getAptBalance(displayAddress)
      .then((value) => {
        if (active) {
          setBalanceState({ kind: "ready", value });
        }
      })
      .catch(() => {
        if (active) {
          setBalanceState({ kind: "failed" });
        }
      });

    return () => {
      active = false;
    };
  }, [displayAddress, isPanelOpen]);

  async function handleConnect(walletName: string) {
    setStatus("connecting");
    setPendingWalletName(walletName);
    authStartedRef.current = false;
    setMessage(`Waiting for ${walletName}. Approve the connection and signature request.`);

    try {
      await Promise.resolve(connect(walletName));
    } catch (error) {
      setPendingWalletName(null);
      setStatus("failed");
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not connect the selected Aptos wallet.",
      );
    }
  }

  async function handleLogout() {
    setStatus("logging_out");
    setMessage("");

    try {
      await Promise.resolve(disconnect());
      await fetch("/api/auth/logout", { method: "POST" });
      setHydratedSession({ authenticated: false });
      setPanelOpen(false);
      setPendingWalletName(null);
      setStatus("idle");
    } catch (error) {
      setStatus("failed");
      setMessage(error instanceof Error ? error.message : "Could not log out.");
    }
  }

  function openPanel() {
    setBalanceState(displayAddress ? { kind: "loading" } : { kind: "idle" });
    setPanelOpen(true);
  }

  return (
    <div className="hidden md:block">
      <button
        type="button"
        data-action={hasActiveSession ? "wallet.details.open" : "wallet.connect.open"}
        aria-label={displayAddress ? `Connected wallet ${displayAddress}` : label}
        title={displayAddress ?? label}
        onClick={openPanel}
        disabled={status === "connecting" || status === "logging_out" || isLoading}
        className="inline-flex min-h-8 items-center gap-2 rounded border border-border bg-surface-low px-3 py-1 font-mono text-xs text-foreground transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-70"
      >
        <Wallet aria-hidden className="h-4 w-4 text-muted" />
        <span>{status === "connecting" ? "Connecting..." : label}</span>
      </button>

      {isPanelOpen && hasActiveSession ? (
        <WalletDetailsDialog
          address={displayAddress}
          balanceState={balanceState}
          message={
            message ||
            (!connected && displayAddress
              ? "Your web session is active. Reconnect the wallet only when a new signature is required."
              : "")
          }
          status={status}
          walletName={wallet?.name ?? (displayAddress ? "Session wallet" : undefined)}
          onClose={() => setPanelOpen(false)}
          onLogout={handleLogout}
        />
      ) : null}

      {isPanelOpen && !hasActiveSession ? (
        <WalletPickerDialog
          extensionWallets={extensionWallets}
          isBusy={status === "connecting" || isLoading}
          message={message}
          onClose={() => setPanelOpen(false)}
          onConnect={handleConnect}
        />
      ) : null}
    </div>
  );
}

function WalletDetailsDialog({
  address,
  balanceState,
  message,
  onClose,
  onLogout,
  status,
  walletName,
}: {
  address?: string;
  balanceState: BalanceState;
  message: string;
  onClose: () => void;
  onLogout: () => void;
  status: WalletActionStatus;
  walletName?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 px-4 pt-14 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-details-title"
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 text-left shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="wallet-details-title" className="text-xl font-semibold text-foreground">
              Wallet details
            </h2>
            <p className="mt-1 text-sm text-muted">
              Connected wallet information for this browser session.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1 text-sm font-semibold text-muted transition-colors hover:text-foreground"
          >
            Close
          </button>
        </div>

        <dl className="mt-5 space-y-4">
          <DetailRow label="Wallet" value={walletName ?? "Aptos wallet"} />
          <DetailRow label="Address" value={address ?? "Wallet adapter is restoring address"} />
          <DetailRow label="Network" value="Aptos Testnet" />
          <DetailRow label="Balance" value={balanceLabel(balanceState)} />
        </dl>

        {message ? <p className="mt-4 text-sm text-muted">{message}</p> : null}

        <button
          type="button"
          onClick={onLogout}
          disabled={status === "logging_out"}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-error hover:text-error disabled:cursor-not-allowed disabled:opacity-70"
        >
          <LogOut aria-hidden className="h-4 w-4" />
          {status === "logging_out" ? "Logging out..." : "Log out"}
        </button>
      </div>
    </div>
  );
}

function WalletPickerDialog({
  extensionWallets,
  isBusy,
  message,
  onClose,
  onConnect,
}: {
  extensionWallets: ReadonlyArray<{ name: string }>;
  isBusy: boolean;
  message: string;
  onClose: () => void;
  onConnect: (walletName: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 px-4 pt-14 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-picker-title"
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 text-left shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="wallet-picker-title" className="text-xl font-semibold text-foreground">
              Choose a wallet
            </h2>
            <p className="mt-1 text-sm text-muted">
              Select one installed Aptos wallet extension to reconnect this session.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1 text-sm font-semibold text-muted transition-colors hover:text-foreground"
          >
            Close
          </button>
        </div>

        {extensionWallets.length > 0 ? (
          <div className="mt-5 space-y-3">
            {extensionWallets.map((availableWallet) => (
              <button
                key={availableWallet.name}
                data-action={`wallet.connect.${slugWalletName(availableWallet.name)}`}
                type="button"
                aria-label={availableWallet.name}
                onClick={() => onConnect(availableWallet.name)}
                disabled={isBusy}
                className="flex min-h-12 w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:bg-surface-high disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="inline-flex items-center gap-2">
                  <Wallet aria-hidden className="h-5 w-5 text-primary" />
                  {availableWallet.name}
                </span>
                <span aria-hidden className="text-xs text-muted">Connect</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-border bg-background p-4">
            <p className="font-semibold text-foreground">
              No Aptos wallet extension detected.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Install Petra, Martian, Pontem, Fewcha, or Rise, unlock the wallet,
              then refresh this page.
            </p>
          </div>
        )}

        {message ? <p className="mt-4 text-sm text-muted">{message}</p> : null}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-strong">
        {label}
      </dt>
      <dd className="mt-1 break-all font-mono text-sm text-foreground">{value}</dd>
    </div>
  );
}

function balanceLabel(balanceState: BalanceState) {
  switch (balanceState.kind) {
    case "loading":
      return "Loading balance...";
    case "ready":
      return balanceState.value;
    case "failed":
      return "Balance unavailable";
    case "idle":
      return "Balance unavailable";
  }
}
