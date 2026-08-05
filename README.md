# Private Rollup

Private Rollup is an English-only web application for browser-encrypted uploads
that share Shelby blobs without sharing plaintext. The target payment model uses
a Shelbynet Payment Vault smart contract: users sign upload payments from their
own browser wallet, the vault locks funds while a pack is open, and the final
storage charge is allocated by each member's ciphertext bytes.

## Money and custody model

- The displayed balance is denominated in APT; the database stores integer octas.
- There are no app credits, promotional grants, or unbacked balances.
- User funds are held by the Payment Vault contract, not by a backend-held
  private key.
- Users pay for each upload from their connected wallet.
- Upload funds are reserved while a shared pack is open.
- The platform fee is released to the owner only after successful Shelby
  settlement.
- Failed uploads before settlement remain fully refundable.
- Browser plaintext and file keys never reach the server.

## Local setup

```bash
pnpm install
pnpm db:migrate
pnpm dev
```

Copy `.env.example` to `.env.local` and configure Postgres, private Vercel Blob,
Shelby, authentication, and Payment Vault settings.

### Shelbynet direct payment requirement

The Payment Vault design requires public Shelbynet Move entry points that allow
a third-party contract to register and pay for Shelby storage. Configure:

- `SHELBY_DIRECT_PAYMENT_MODULE_ADDRESS`
- `SHELBY_DIRECT_REGISTER_FUNCTION`
- `SHELBY_DIRECT_PAY_FUNCTION`
- `SHELBY_STORAGE_COIN_TYPE`

If these values are not available, the app must fail closed for real
vault-backed uploads instead of falling back to a server-custodied wallet.

### Payment Vault contract

The Move package lives in `contracts/payment-vault`. Run contract tests with:

```bash
aptos move test --package-dir contracts/payment-vault --named-addresses private_rollup=0xA11CE --skip-fetch-latest-git-deps
```

For deployment, publish the package from the platform owner account and set:

- `PAYMENT_VAULT_CONTRACT_ADDRESS`: published `private_rollup` address.
- `PAYMENT_VAULT_OWNER_ADDRESS`: platform owner address that can withdraw earned fees.
- `PAYMENT_VAULT_OPERATOR_PRIVATE_KEY`: operator key used only to report upload success or failure.

The contract holds upload funds, transfers the actual Shelby cost to the
configured Shelby payment recipient on success, releases platform fees only
after success, and keeps failed uploads refundable.

## Verification

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build:cli
pnpm build
```
