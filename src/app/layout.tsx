import type { Metadata } from "next";
import { AptosWalletProvider } from "@/components/aptos-wallet-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Private Rollup",
  description: "Encrypted upload control plane for shared Shelby blob packs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">
        <AptosWalletProvider>{children}</AptosWalletProvider>
      </body>
    </html>
  );
}
