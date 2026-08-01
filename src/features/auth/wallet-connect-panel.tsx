"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import Link from "next/link";
import { Wallet, Terminal } from "lucide-react";
import {
  createWalletChallenge,
  verifyWalletChallenge,
} from "@/client/api/auth";

type ConnectionStatus = "idle" | "connecting" | "connected" | "failed";

export function WalletConnectPanel() {
  const { account, connect, connected, isLoading, signMessage, wallets } = useWallet();
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [message, setMessage] = useState("");
  const [pendingWalletName, setPendingWalletName] = useState<string | null>(null);
  const authStartedRef = useRef(false);
  const statusMessage = message || walletDetectionMessage(wallets);

  useEffect(() => {
    if (!pendingWalletName || !connected || !account || authStartedRef.current) {
      return;
    }

    authStartedRef.current = true;

    void authenticateConnectedWallet({
      account,
      signMessage,
      onSuccess: (chainId, walletAddress) => {
        setStatus("connected");
        setPendingWalletName(null);
        setMessage(`Connected ${shortAddress(walletAddress)} on ${chainId}.`);
      },
      onFailure: (error) => {
        authStartedRef.current = false;
        setStatus("failed");
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not verify the selected Aptos wallet.",
        );
      },
    });
  }, [account, connected, pendingWalletName, signMessage]);

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

  return (
    <div className="mt-8">
      <div className="flex flex-col items-center justify-center gap-4">
        {wallets.length > 0 ? (
          <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
            {wallets.map((wallet) => (
              <button
                key={wallet.name}
                data-action={`wallet.connect.${slugWalletName(wallet.name)}`}
                type="button"
                onClick={() => handleConnect(wallet.name)}
                disabled={status === "connecting" || isLoading}
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

function walletDetectionMessage(wallets: ReadonlyArray<{ name: string }>) {
  if (wallets.length > 0) {
    return "Choose the wallet extension you want to use for this browser session.";
  }

  return "Install a supported wallet extension to continue.";
}

function slugWalletName(walletName: string) {
  return walletName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function authenticateConnectedWallet({
  account,
  signMessage,
  onSuccess,
  onFailure,
}: {
  account: {
    address: { toString: () => string };
    publicKey?: { toString: () => string } | null;
  };
  signMessage: (message: {
    address: boolean;
    application: boolean;
    chainId: boolean;
    message: string;
    nonce: string;
  }) => Promise<{ signature: unknown; fullMessage?: string }>;
  onSuccess: (chainId: string, walletAddress: string) => void;
  onFailure: (error: unknown) => void;
}) {
  try {
    const walletAddress = account.address.toString();
    const publicKey = account.publicKey?.toString();

    if (!publicKey) {
      throw new Error("The connected wallet did not expose a public key.");
    }

    const challenge = await createWalletChallenge({
      walletAddress,
      domain: window.location.hostname,
      uri: window.location.origin,
      chainId: "aptos-testnet",
    });
    const signedChallenge = await signMessage({
      address: true,
      application: true,
      chainId: true,
      message: challenge.message,
      nonce: extractChallengeNonce(challenge.message),
    });
    const result = await verifyWalletChallenge({
      challengeId: challenge.id,
      walletAddress,
      publicKey,
      domain: window.location.hostname,
      signature: String(signedChallenge.signature),
      fullMessage: signedChallenge.fullMessage,
    });

    onSuccess(result.chainId, walletAddress);
  } catch (error) {
    onFailure(error);
  }
}

function extractChallengeNonce(message: string) {
  return message.match(/^Nonce:\s*(.+)$/m)?.[1]?.trim() ?? "";
}
