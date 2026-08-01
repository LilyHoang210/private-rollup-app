"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Wallet, Terminal } from "lucide-react";
import {
  createWalletChallenge,
  verifyWalletChallenge,
} from "@/client/api/auth";
import {
  connectAptosWallet,
  detectAptosWallets,
  signAuthChallenge,
  type DetectedAptosWallet,
} from "@/client/wallets/aptos-wallets";

type ConnectionStatus = "detecting" | "idle" | "connecting" | "connected" | "failed";

export function WalletConnectPanel() {
  const wallets = useSyncExternalStore(
    subscribeToWalletDetection,
    getClientWalletSnapshot,
    getServerWalletSnapshot,
  );
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [message, setMessage] = useState("");
  const statusMessage = message || walletDetectionMessage(wallets);

  async function handleConnect(wallet: DetectedAptosWallet) {
    setStatus("connecting");
    setMessage(`Waiting for ${wallet.name}. Approve the connection and signature request.`);

    try {
      const account = await connectAptosWallet(wallet.provider);
      const challenge = await createWalletChallenge({
        walletAddress: account.address,
        domain: window.location.hostname,
        uri: window.location.origin,
        chainId: "aptos-testnet",
      });
      const signedChallenge = await signAuthChallenge(wallet.provider, challenge.message);
      const result = await verifyWalletChallenge({
        challengeId: challenge.id,
        walletAddress: account.address,
        publicKey: account.publicKey,
        domain: window.location.hostname,
        signature: signedChallenge.signature,
        fullMessage: signedChallenge.fullMessage,
      });

      setStatus("connected");
      setMessage(`Connected ${shortAddress(account.address)} on ${result.chainId}.`);
    } catch (error) {
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
        {wallets.length > 0 ? (
          <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
            {wallets.map((wallet) => (
              <button
                key={wallet.id}
                data-action={`wallet.connect.${wallet.id}`}
                type="button"
                onClick={() => handleConnect(wallet)}
                disabled={status === "connecting"}
                className="btn-primary inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-transparent bg-primary-container px-8 py-2 text-sm font-semibold text-primary shadow-[0_0_15px_rgba(173,200,245,0.1)] transition-colors hover:bg-[#455f87] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Wallet aria-hidden className="h-5 w-5" />
                {status === "connecting" ? "Connecting..." : `Connect ${wallet.name}`}
              </button>
            ))}
          </div>
        ) : (
          <div className="w-full max-w-2xl rounded-xl border border-border bg-surface/80 p-4 text-left">
            <div className="flex items-start gap-3">
              <Wallet aria-hidden className="mt-1 h-5 w-5 text-accent" />
              <div>
                <p className="font-semibold text-foreground">
                  No Aptos wallet extension detected.
                </p>
                <p className="mt-1 text-sm text-muted">
                  Install Petra, Martian, Pontem, Fewcha, or Rise, unlock the wallet,
                  then refresh this page. The app only asks the wallet to sign a login
                  challenge; it never asks for your private key or seed phrase.
                </p>
              </div>
            </div>
          </div>
        )}
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
    </div>
  );
}

function shortAddress(address: string) {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const emptyWalletSnapshot: DetectedAptosWallet[] = [];
let cachedWalletKey = "";
let cachedWalletSnapshot: DetectedAptosWallet[] = emptyWalletSnapshot;

function subscribeToWalletDetection() {
  return () => undefined;
}

function getServerWalletSnapshot() {
  return emptyWalletSnapshot;
}

function getClientWalletSnapshot() {
  const detectedWallets = detectAptosWallets();
  const walletKey = detectedWallets.map((wallet) => wallet.id).join("|");

  if (walletKey === cachedWalletKey) {
    return cachedWalletSnapshot;
  }

  cachedWalletKey = walletKey;
  cachedWalletSnapshot = detectedWallets;
  return detectedWallets;
}

function walletDetectionMessage(wallets: DetectedAptosWallet[]) {
  if (wallets.length > 0) {
    return "Choose the wallet extension you want to use for this browser session.";
  }

  return "Install a supported wallet extension to continue.";
}
