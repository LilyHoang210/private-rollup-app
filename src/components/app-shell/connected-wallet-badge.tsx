"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Wallet } from "lucide-react";

export function ConnectedWalletBadge() {
  const { account, connected, isLoading } = useWallet();
  const address = account?.address?.toString();
  const label = address
    ? shortAddress(address)
    : connected || isLoading
      ? "Wallet connected"
      : "Wallet not connected";

  return (
    <div
      className="hidden items-center gap-2 rounded border border-border bg-surface-low px-3 py-1 md:flex"
      title={address ?? label}
      aria-label={address ? `Connected wallet ${address}` : label}
    >
      <Wallet aria-hidden className="h-4 w-4 text-muted" />
      <span className="font-mono text-xs text-foreground">{label}</span>
    </div>
  );
}

function shortAddress(address: string) {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
