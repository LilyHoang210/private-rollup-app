# Real Shelby Upload Implementation Plan

**Goal:** Replace metadata-only demo uploads with recoverable client-side encryption and a server-paid Shelby upload that can be independently verified.

**Approved product model:** Users prepay app credits. The browser encrypts files. A service account pays APT and Shelby storage fees. Billing is proportional to ciphertext bytes. Private keys and plaintext never reach the server.

## Scope for this release

1. Generate a real X25519 vault in the browser, export a recovery kit, and reuse the saved public key for uploads.
2. Build a versioned encrypted pack containing ciphertext plus encrypted per-file metadata; never include plaintext bytes or raw DEKs.
3. Add a Shelby Node SDK writer behind a strict environment readiness check.
4. Upload the encrypted pack with the service signer, verify committed object metadata on chain, and return a receipt with owner, blob name, size, expiry, and transaction evidence when available.
5. Make the UI fail closed when Shelby is unavailable; remove the local-success fallback that falsely resembles a completed upload.
6. Add tests for package construction, configuration, writer orchestration, API validation, and user-facing success/error states.
7. Configure a dedicated Shelbynet service account, fund it, deploy, upload a smoke-test file in Chrome, and independently download/inspect the blob bytes.

## Explicit limitation

This release writes one encrypted pack per submitted batch immediately. Cross-user delayed aggregation needs durable staging storage and a job database; production has neither configured today. The receipt format and byte-based billing remain compatible with adding that pack worker later.

## Verification

- Unit/component/API tests, lint, typecheck, production build, and Playwright.
- Production `/api/storage/status` reports `ready` only with a valid signer configuration.
- Chrome upload returns a real Shelby owner/blob name and verified state.
- Direct Shelby download returns bytes whose SHA-256 matches the receipt.
