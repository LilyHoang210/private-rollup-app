"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wallet, Terminal } from "lucide-react";
import {
  authenticateConnectedWallet,
  isExtensionWallet,
  shortAddress,
  slugWalletName,
  walletDetectionMessage,
} from "./wallet-auth";

type ConnectionStatus = "idle" | "connecting" | "connected" | "failed";

export function WalletConnectPanel() {
  const { account, connect, connected, isLoading, signMessage, wallets } = useWallet();
  const router = useRouter();
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [message, setMessage] = useState("");
  const [pendingWalletName, setPendingWalletName] = useState<string | null>(null);
  const [isWalletPickerOpen, setWalletPickerOpen] = useState(false);
  const authStartedRef = useRef(false);
  const extensionWallets = wallets.filter(isExtensionWallet);
  const statusMessage = message || walletDetectionMessage(extensionWallets);

  useEffect(() => {
    if (!pendingWalletName || !connected || !account || authStartedRef.current) {
      return;
    }

    authStartedRef.current = true;

    void (async () => {
      try {
        const { chainId, walletAddress } = await authenticateConnectedWallet({
          account,
          signMessage,
        });
        setStatus("connected");
        setPendingWalletName(null);
        setMessage(`Connected ${shortAddress(walletAddress)} on ${chainId}.`);
        router.push("/app/setup");
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
  }, [account, connected, pendingWalletName, router, signMessage]);

  async function handleConnect(walletName: string) {
    setStatus("connecting");
    setPendingWalletName(walletName);
    setWalletPickerOpen(false);
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

  return (
    <div className="mt-8">
      <div className="flex flex-col items-center justify-center gap-4">
        <button
          data-action="wallet.connect.open"
          type="button"
          onClick={() => setWalletPickerOpen(true)}
          disabled={status === "connecting" || isLoading}
          className="btn-primary inline-flex min-h-11 w-full max-w-2xl items-center justify-center gap-2 rounded-lg border border-transparent bg-primary-container px-8 py-2 text-sm font-semibold text-primary shadow-[0_0_15px_rgba(173,200,245,0.1)] transition-colors hover:bg-[#455f87] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          <Wallet aria-hidden className="h-5 w-5" />
          {status === "connecting" ? "Connecting..." : "Connect wallet"}
        </button>
        <Link
          data-action="nav.recovery"
          href="/app/recovery"
          className="inline-flex min-h-11 w-full max-w-2xl items-center justify-center gap-2 rounded-lg border border-border bg-surface px-8 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-high sm:w-auto"
        >
          <Terminal aria-hidden className="h-5 w-5" />
          See recovery flow
        </Link>
      </div>
      <p aria-live="polite" className="mt-3 text-sm text-muted">
        {statusMessage}
      </p>
      {isWalletPickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
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
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Select one installed Aptos wallet extension. The app will ask it to
                  sign a login challenge; it will not ask for your private key.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWalletPickerOpen(false)}
                className="rounded-lg border border-border px-3 py-1 text-sm font-semibold text-muted transition-colors hover:text-foreground"
              >
                Close
              </button>
            </div>

            {extensionWallets.length > 0 ? (
              <div className="mt-5 space-y-3">
                {extensionWallets.map((wallet) => (
                  <button
                    key={wallet.name}
                    data-action={`wallet.connect.${slugWalletName(wallet.name)}`}
                    type="button"
                    aria-label={wallet.name}
                    onClick={() => handleConnect(wallet.name)}
                    disabled={status === "connecting" || isLoading}
                    className="flex min-h-12 w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:bg-surface-high disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Wallet aria-hidden className="h-5 w-5 text-primary" />
                      {wallet.name}
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
          </div>
        </div>
      ) : null}
    </div>
  );
}
