"use client";

import { useState } from "react";
import Link from "next/link";
import { Wallet, Terminal } from "lucide-react";
import { connectDemoWallet } from "@/client/api/auth";

export function WalletConnectPanel() {
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "failed">(
    "idle",
  );
  const [message, setMessage] = useState("Demo wallet is not connected.");

  async function handleConnect() {
    setStatus("connecting");

    try {
      const result = await connectDemoWallet({
        walletAddress: "0xabc",
        domain: window.location.hostname,
        uri: window.location.origin,
        chainId: "aptos-testnet",
      });
      setStatus("connected");
      setMessage(`Demo session created on ${result.chainId}.`);
    } catch {
      setStatus("failed");
      setMessage("Could not create a demo session.");
    }
  }

  return (
    <div className="mt-8">
      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <button
          data-action="wallet.connect"
          type="button"
          onClick={handleConnect}
          disabled={status === "connecting"}
          className="btn-primary inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-transparent bg-primary-container px-8 py-2 text-sm font-semibold text-primary shadow-[0_0_15px_rgba(173,200,245,0.1)] transition-colors hover:bg-[#455f87] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          <Wallet aria-hidden className="h-5 w-5" />
          {status === "connecting" ? "Connecting..." : "Connect Aptos wallet"}
        </button>
        <Link
          data-action="nav.recovery"
          href="/app/recovery"
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-8 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-high sm:w-auto"
        >
          <Terminal aria-hidden className="h-5 w-5" />
          See recovery flow
        </Link>
      </div>
      <p aria-live="polite" className="mt-3 text-sm text-muted">
        {message}
      </p>
    </div>
  );
}
