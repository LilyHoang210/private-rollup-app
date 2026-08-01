import { WalletConnectPanel } from "@/features/auth/wallet-connect-panel";
import { Box, Clock3, RotateCcwKey, Shield } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="fixed left-0 top-0 z-50 flex h-16 w-full items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Shield aria-hidden className="h-6 w-6 text-primary" />
          <span className="text-2xl font-bold tracking-tight text-white">
            Private Rollup
          </span>
        </div>
        <nav className="hidden items-center gap-6 md:flex" aria-label="Landing">
          <a
            className="text-sm font-semibold text-muted transition-colors hover:text-white"
            href="/app/documentation"
          >
            Documentation
          </a>
          <a
            className="text-sm font-semibold text-muted transition-colors hover:text-white"
            href="/app/support"
          >
            Support
          </a>
        </nav>
      </header>

      <section className="relative mx-auto flex w-full max-w-[1440px] flex-col items-center px-6 pb-16 pt-24">
        <div className="hero-pattern absolute top-20 h-[520px] w-full max-w-3xl opacity-50" />

        <div className="relative z-10 mx-auto max-w-3xl py-12 text-center md:py-20">
          <span className="mb-6 inline-block rounded-full border border-border bg-surface-high px-3 py-1 font-mono text-xs text-primary">
            v2.0.4-aptos-testnet
          </span>
          <h1 className="text-5xl font-bold leading-[1.08] tracking-tight text-white md:text-6xl">
            Secure storage.
            <br />
            Independent recovery.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-7 text-muted">
            Upload private files into shared encrypted storage packs, monitor
            expiration with transparent lifecycle data, and recover through
            receipts plus a local CLI.
          </p>
          <WalletConnectPanel />
        </div>

        <section className="relative z-10 mx-auto mt-10 grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
          <FeatureCard
            icon={<Box aria-hidden className="h-6 w-6" />}
            title="Shared storage packs"
            body="Reduce small-file overhead by grouping encrypted payloads into shared packs. Ownership stays file-scoped through receipts and wrapped keys."
          />
          <FeatureCard
            icon={<Clock3 aria-hidden className="h-6 w-6" />}
            title="Transparent tracking"
            body="Monitor pack lifecycle, retention cohort, expiration windows, and verification state from a dedicated control plane."
            footer={
              <div className="rounded border border-border bg-background px-3 py-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted">TTL</span>
                  <span className="text-accent">365 days</span>
                </div>
              </div>
            }
          />
          <FeatureCard
            icon={<RotateCcwKey aria-hidden className="h-6 w-6" />}
            title="Independent recovery"
            body="Use signed receipts and a local command-line tool to restore files even when the web application is unavailable."
            footer={
              <div className="rounded border border-border bg-background px-3 py-3 font-mono text-xs text-primary">
                <span className="text-muted">$</span> node private-rollup-cli.mjs files pull
              </div>
            }
          />
        </section>
      </section>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  body,
  footer,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  footer?: React.ReactNode;
}) {
  return (
    <article className="flex min-h-[300px] flex-col gap-4 rounded-xl border border-border bg-surface p-6 transition-colors hover:border-primary/50">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-surface-high text-primary">
        {icon}
      </div>
      <div>
        <h2 className="mb-2 text-xl font-bold leading-7 text-white">{title}</h2>
        <p className="text-base leading-6 text-muted">{body}</p>
      </div>
      {footer ? <div className="mt-auto">{footer}</div> : null}
    </article>
  );
}
