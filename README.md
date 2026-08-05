# Private Rollup

Private Rollup is an English-only web application for browser-encrypted uploads
that share Shelby blobs without sharing plaintext. Each authenticated user gets
an isolated Aptos Testnet service wallet. Users deposit real Testnet APT, the app
reserves APT while a pack is open, and the final storage charge is allocated by
each member's ciphertext bytes.

## Money and custody model

- The displayed balance is denominated in APT; the database stores integer octas.
- There are no app credits, promotional grants, or unbacked balances.
- A unique deposit wallet is generated after wallet authentication.
- Its signing key is encrypted with AES-256-GCM before it reaches Postgres.
- Deposits are detected from the wallet's Aptos Testnet balance.
- Only available APT can be withdrawn. APT reserved for an open pack cannot be
  withdrawn until settlement or release.
- Withdrawals return APT only to the wallet in the signed login session.
- A service fee payer sponsors withdrawal gas so the requested available amount
  is not reduced by gas.

Shelby uploads are still signed by the shared Shelby service wallet because a
combined blob has one on-chain owner. Browser plaintext and file keys never reach
the server.

## Local setup

```bash
pnpm install
pnpm db:migrate
pnpm dev
```

Copy `.env.example` to `.env.local` and configure Postgres, private Vercel Blob,
Shelby, authentication, and these custody secrets:

- `CUSTODIAL_WALLET_MASTER_KEY`: exactly 32 random bytes encoded as base64.
- `APTOS_FEE_PAYER_PRIVATE_KEY`: an Aptos Testnet Ed25519 private key funded with
  enough Testnet APT to sponsor withdrawals.

### Shelbynet direct payment requirement

The Payment Vault design requires public Shelbynet Move entry points that allow
a third-party contract to register and pay for Shelby storage. Configure:

- `SHELBY_DIRECT_PAYMENT_MODULE_ADDRESS`
- `SHELBY_DIRECT_REGISTER_FUNCTION`
- `SHELBY_DIRECT_PAY_FUNCTION`
- `SHELBY_STORAGE_COIN_TYPE`

If these values are not available, the app must fail closed for real
vault-backed uploads instead of falling back to a server-custodied wallet.

## Verification

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build:cli
pnpm build
```
