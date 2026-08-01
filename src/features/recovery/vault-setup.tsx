"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";

export function VaultSetupPanel() {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ready"; ownerFingerprint: string }
    | { kind: "failed"; message: string }
  >({ kind: "idle" });

  async function initializeVault() {
    setState({ kind: "loading" });

    try {
      const response = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKeyBytes: "demo-x25519-public-key",
          algorithm: "DHKEM_X25519_HKDF_SHA256",
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Connect your wallet before initializing the vault.");
        }
        throw new Error("Vault registration failed. Check your connection and try again.");
      }

      const body = (await response.json()) as { ownerFingerprint: string };
      setState({ kind: "ready", ownerFingerprint: body.ownerFingerprint });
    } catch (error) {
      setState({
        kind: "failed",
        message:
          error instanceof Error
            ? error.message
            : "Vault registration failed. Check your connection and try again.",
      });
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-surface-high text-primary">
          <KeyRound aria-hidden className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Vault readiness</h2>
          <p className="mt-2 text-muted">
            Register public encryption material before uploads are enabled.
          </p>
        </div>
      </div>

      <button
        data-action="vault.initialize"
        type="button"
        onClick={initializeVault}
        disabled={state.kind === "loading"}
        className="mt-6 flex min-h-11 w-full items-center justify-center rounded bg-primary px-4 py-2 text-sm font-semibold text-[#133155] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {state.kind === "loading" ? "Initializing..." : "Initialize Vault"}
      </button>

      <div aria-live="polite" className="mt-4 text-sm text-muted">
        {state.kind === "idle" ? "Vault public key is not registered yet." : null}
        {state.kind === "failed" ? state.message : null}
        {state.kind === "ready" ? (
          <p>
            Owner fingerprint{" "}
            <span className="font-mono text-primary">
              {state.ownerFingerprint.slice(0, 12)}...
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
