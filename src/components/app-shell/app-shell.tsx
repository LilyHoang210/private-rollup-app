import Link from "next/link";
import type { ReactNode } from "react";
import {
  Archive,
  CircleHelp,
  FileText,
  Gauge,
  RotateCcwKey,
  Shield,
  Sparkles,
  Upload,
} from "lucide-react";
import { HeaderActions } from "./header-actions";

const navItems = [
  { href: "/app", label: "Dashboard", action: "nav.dashboard", icon: Gauge },
  { href: "/app/upload", label: "File Upload", action: "nav.upload", icon: Upload },
  { href: "/app/packs", label: "Blob Packs", action: "nav.packs", icon: Archive },
  { href: "/app/setup", label: "Setup Wizard", action: "nav.setup", icon: Sparkles },
  {
    href: "/app/recovery",
    label: "Recovery",
    action: "nav.recovery",
    icon: RotateCcwKey,
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground md:h-screen md:overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-background"
      >
        Skip to content
      </a>
      <div className="grid min-h-screen md:h-screen md:grid-cols-[256px_1fr]">
        <aside className="hidden flex-col border-r border-border bg-[#060e20] px-2 py-4 text-primary md:flex">
          <div className="mb-8 px-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[#133155]">
                <Shield aria-hidden className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">Private Rollup</p>
                <p className="font-mono text-xs text-muted">Aptos Testnet</p>
              </div>
            </div>
            <Link
              data-action="vault.initialize"
              href="/app/recovery"
              className="mt-6 flex min-h-11 w-full items-center justify-center rounded bg-primary px-4 py-2 text-sm font-semibold text-[#133155] transition-opacity hover:opacity-90"
            >
              Initialize Vault
            </Link>
          </div>
          <nav aria-label="Primary">
            <ul className="space-y-1">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    data-action={item.action}
                    href={item.href}
                    className="flex min-h-11 items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-muted transition-all duration-200 hover:bg-surface-highest hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <item.icon aria-hidden className="h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav className="mt-auto border-t border-border pt-4" aria-label="Secondary">
            <Link
              href="/app/support"
              className="flex min-h-10 items-center gap-3 rounded-lg px-4 py-2 text-sm font-semibold text-muted transition hover:bg-surface-highest hover:text-foreground"
            >
              <CircleHelp aria-hidden className="h-4 w-4" />
              Support
            </Link>
            <Link
              href="/app/documentation"
              className="flex min-h-10 items-center gap-3 rounded-lg px-4 py-2 text-sm font-semibold text-muted transition hover:bg-surface-highest hover:text-foreground"
            >
              <FileText aria-hidden className="h-4 w-4" />
              Documentation
            </Link>
          </nav>
        </aside>

        <div className="flex min-h-screen flex-col md:h-screen md:min-h-0">
          <header className="flex min-h-11 items-center justify-between border-b border-border bg-background px-6 text-primary">
            <div className="hidden items-center gap-2 rounded-full border border-border bg-surface-low px-3 py-1 md:flex">
              <span className="h-2 w-2 rounded-full bg-accent" />
              <span className="font-mono text-xs text-foreground">Aptos Testnet</span>
            </div>
            <div className="flex items-center gap-3 md:hidden">
              <Shield aria-hidden className="h-5 w-5 text-primary" />
              <span className="text-xl font-bold text-primary">Private Rollup</span>
            </div>
            <HeaderActions />
          </header>

          <main
            id="main-content"
            className="flex-1 overflow-y-auto px-4 py-6 pb-24 md:px-8 md:pb-8"
          >
            {children}
          </main>

          <nav
            aria-label="Primary mobile"
            className="fixed bottom-0 left-0 z-50 grid h-16 w-full grid-cols-5 rounded-t-xl border-t border-border bg-surface-low px-2 pb-2 shadow-lg md:hidden"
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                data-action={item.action}
                href={item.href}
                className="flex min-h-14 flex-col items-center justify-center gap-1 px-2 text-[10px] font-semibold text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <item.icon aria-hidden className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
