# Private Rollup

Private Rollup is a working MVP for browser-encrypted uploads, shared Shelby
blob packs, Payment Vault settlement, and local CLI recovery.

Live app: <https://private-rollup-app-lily-c9d2.vercel.app>

Payment Vault contract on Shelbynet:

```text
0xb0a727508f1824cb3943b3acaa911d0a37efa90ed76180be91b4065dbbb6b97a
```

## What it does

Private Rollup lets users upload files privately by encrypting file bytes in the
browser, staging only ciphertext, grouping compatible uploads into shared pack
pools, and storing verified encrypted packs through Shelby.

The product is designed to make Shelby easier for normal users while preserving
clear ownership, transparent payment, and recovery outside the webapp.

## Core workflow

1. A user connects an Aptos-compatible browser wallet.
2. The browser prepares vault and recovery material.
3. Files are encrypted locally before upload.
4. The user signs a Payment Vault reservation transaction in APT.
5. The backend verifies that transaction on Shelbynet before accepting upload
   metadata.
6. Ciphertext is staged privately.
7. Shared pack pools collect compatible uploads by retention period.
8. Packs are uploaded to Shelby when the pool reaches the byte threshold or the
   wait-time limit.
9. Shelby metadata is verified.
10. The Payment Vault settles Shelby cost, releases platform fees only after
    success, and keeps unused funds refundable.
11. Users can download receipts and recover with local CLI commands.

## Money and custody model

- Users pay in APT from their connected wallet.
- There are no app credits, promotional grants, or unbacked balances.
- Upload funds are held by the Payment Vault contract, not by a backend-held
  private key.
- The backend verifies the on-chain reservation transaction before accepting
  durable upload metadata.
- Payment Vault reimburses the service signer for Shelby cost only after
  verified settlement.
- Platform fees are released only after successful Shelby settlement.
- Failed uploads before settlement remain refundable.
- Browser plaintext and file keys never reach the server.

## Pack pools

Shared packs are separated by retention cohort:

- 30 days
- 90 days
- 365 days

Shared pack upload conditions:

- Upload when a retention pool reaches `8 MiB`.
- Upload when the oldest waiting batch reaches `5 minutes`.
- Shared pack maximum size is `50 MiB`.

Dedicated blobs can be used for larger uploads.

## Technology

- Next.js app router
- Aptos wallet adapter
- Shelbynet Payment Vault Move contract
- Shelby Node SDK storage writer
- Browser-side chunk encryption
- HPKE/X25519 DEK wrapping
- Private Vercel Blob ciphertext staging
- Drizzle/Postgres durable control plane
- Playwright E2E tests

## Local setup

```bash
pnpm install
cp .env.example .env.local
pnpm db:migrate
pnpm dev
```

Configure Postgres, private Vercel Blob, Shelby, authentication, and Payment
Vault settings in `.env.local`. Do not commit real environment values.

## Payment Vault contract

The Move package lives in `contracts/payment-vault`.

Run contract tests:

```bash
aptos move test --package-dir contracts/payment-vault --named-addresses private_rollup=0xA11CE --skip-fetch-latest-git-deps
```

Production-like deployment requires:

- `PAYMENT_VAULT_CONTRACT_ADDRESS`: published `private_rollup` address.
- `PAYMENT_VAULT_OWNER_ADDRESS`: platform owner address.
- `PAYMENT_VAULT_OPERATOR_PRIVATE_KEY`: operator key for upload success/failure
  reporting.
- `SHELBY_ACCOUNT_PRIVATE_KEY`: service signer used for Shelby uploads.

## Verification

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build:cli
pnpm build
pnpm test:e2e
```

Latest verified state before public release:

- Unit/integration tests: 146 passed.
- E2E tests: 5 passed.
- Lint, typecheck, and production build passed.
- Production storage status: Shelby / Shelbynet ready.
- Legacy direct upload endpoint returns `410`.

## Security status

This repository is an MVP / functional prototype. It should not be described as
production-grade secure until it receives independent cryptography, contract,
and application security review.

Current security-oriented design choices:

- Plaintext stays in the browser.
- Backend stores encrypted metadata/control-plane state only.
- Payment Vault reservations are verified on-chain.
- Upload failure before settlement keeps funds refundable.
- CLI recovery documentation is provided so recovery does not depend entirely
  on the hosted webapp.

## License

MIT.
