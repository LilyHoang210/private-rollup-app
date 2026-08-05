"use client";

import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { SHELBY_APTOS_NETWORK } from "@/config/shelbynet";

export function AptosWalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <AptosWalletAdapterProvider
      autoConnect
      dappConfig={{ network: SHELBY_APTOS_NETWORK }}
      disableTelemetry
    >
      {children}
    </AptosWalletAdapterProvider>
  );
}
