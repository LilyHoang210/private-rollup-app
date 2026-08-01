"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wallet, Terminal } from "lucide-react";
import {
  createWalletChallenge,
  verifyWalletChallenge,
} from "@/client/api/auth";

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

    void authenticateConnectedWallet({
      account,
      signMessage,
      onSuccess: (chainId, walletAddress) => {
        setStatus("connected");
        setPendingWalletName(null);
        setMessage(`Connected ${shortAddress(walletAddress)} on ${chainId}.`);
        router.push("/app");
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

function shortAddress(address: string) {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function walletDetectionMessage(wallets: ReadonlyArray<{ name: string }>) {
  if (wallets.length > 0) {
    return "Click Connect wallet to choose an installed Aptos wallet extension.";
  }

  return "Install a supported wallet extension to continue.";
}

function isExtensionWallet(wallet: { name: string }) {
  return !wallet.name.toLowerCase().startsWith("continue with ");
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
