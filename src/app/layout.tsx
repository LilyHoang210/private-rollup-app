import type { Metadata } from "next";
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
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
