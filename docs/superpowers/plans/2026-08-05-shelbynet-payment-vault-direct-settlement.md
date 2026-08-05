# Shelbynet Payment Vault Direct Settlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the server-held upload payment wallet with a Shelbynet `PaymentVault` smart contract that receives per-upload payments, directly pays Shelby when protocol support exists, releases platform fees only after successful upload settlement, and exposes full refunds for failed uploads.

**Architecture:** The user keeps their existing browser wallet; the webapp's payment wallet becomes a Shelbynet Move contract. Frontend encrypts files locally and asks the user to sign one upload-payment transaction; backend coordinates pack building and encrypted-byte upload; the contract is the source of truth for reservations, settlement, owner fees, and refunds. Implementation is gated by a Shelby direct-payment capability check because the current public SDK documents signer-based on-chain registration and RPC byte upload.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Vitest, Playwright, Drizzle/Postgres, Aptos TypeScript SDK 7.2.0, Aptos Move, Shelby SDK 0.4.1, Shelbynet/Testnet.

## Execution Status

- [x] Tasks 1-8 implemented and committed.
- [x] Payment Vault reservation metadata is indexed for durable pack settlement.
- [x] Header, dashboard billing, pack pool, recovery, and documentation UX now explain Payment Vault payment/refund behavior in English.
- [x] Local verification passed: TypeScript, ESLint, Vitest, Next.js production build, Move unit tests, and Playwright E2E.
- [ ] Live Shelbynet upload verification remains gated until `PAYMENT_VAULT_CONTRACT_ADDRESS` and Shelby direct-payment interface environment variables are configured in the deployed environment.

## Global Constraints

- All visible website content must remain English.
- User wallet selection is unchanged; Petra, OKX, and other detected browser wallets remain user wallets.
- The webapp payment wallet is a Shelbynet smart contract, not a backend-held private key.
- No off-chain credits.
- Backend must not custody user upload funds.
- Platform fee is charged only after successful Shelby upload settlement.
- Failed uploads before settlement expose a full refund path.
- Plaintext files never leave the browser.
- Shared packs must show size threshold, max wait time, current progress, user contribution, and settlement status.
- Do not silently fall back to server-custodied balances if Shelby direct contract payment is unavailable.

---

## File Structure

- Create: `contracts/payment-vault/Move.toml`  
  Aptos Move package definition for the vault contract.

- Create: `contracts/payment-vault/sources/payment_vault.move`  
  Production vault module with config, upload reservations, settlement, refunds, owner/operator permissions, and events.

- Create: `contracts/payment-vault/sources/mock_shelby_payment.move`  
  Test-only Shelby payment mock used by Move unit tests.

- Create: `contracts/payment-vault/tests/payment_vault_tests.move`  
  Move unit tests for deposit/reserve, successful settlement, failed refund, timeout refund, owner fee release, pause, and permission checks.

- Create: `src/server/shelby/direct-payment-capabilities.ts`  
  Runtime capability checker for direct Shelby Move payment support.

- Create: `src/server/vault/payment-vault-types.ts`  
  Shared TypeScript types for vault quote, reservation, settlement, refund, and event state.

- Create: `src/server/vault/payment-vault-client.ts`  
  Aptos TS SDK wrapper for reading vault state and building user/operator transactions.

- Create: `src/server/vault/payment-vault-service.ts`  
  Domain service that replaces server-held APT balance logic with contract-backed upload accounting.

- Create: `src/client/api/payment-vault.ts`  
  Browser API client for quote, reservation status, settlement status, and refund actions.

- Modify: `src/server/db/schema.ts`  
  Add contract-backed vault request/event index tables and deprecate current server-held `apt_accounts`/`custodial_wallets` usage for upload payments.

- Modify: `src/server/billing/apt-account-service.ts`  
  Stop using this service for new upload reservations; keep only compatibility paths for old records during migration.

- Modify: `src/server/uploads/service.ts`  
  Require a vault reservation before creating/staging upload batches.

- Modify: `src/server/packs/worker.ts`  
  Settle packs through `PaymentVaultClient` instead of local `settlePackCostByBytes`.

- Modify: `src/features/upload/upload-panel.tsx`  
  Replace service-wallet balance UI with quote review, `Pay and upload`, settlement/refund states.

- Modify: `src/components/app-shell/connected-wallet-badge.tsx`  
  Show connected wallet identity and Payment Vault status separately.

- Modify: `src/features/billing/apt-balance-panel.tsx`  
  Replace deposit/withdraw against server wallet with vault refund/withdraw and reservation history.

- Modify: `src/app/app/packs/page.tsx`  
  Show pack-pool payment conditions and user's reserved/settled/refundable share.

- Modify: `src/app/app/recovery/page.tsx` and documentation page components  
  Add contract address, explorer link, CLI recovery guidance, and direct refund instructions.

- Create/Modify tests under `tests/vault`, `tests/billing`, `tests/uploads`, `tests/packs`, `tests/auth`, and `e2e`.

---

### Task 1: Shelby Direct-Payment Capability Gate

**Files:**
- Create: `src/server/shelby/direct-payment-capabilities.ts`
- Create: `tests/storage/direct-payment-capabilities.test.ts`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Produces:
  ```ts
  export interface ShelbyDirectPaymentCapabilities {
    supported: boolean;
    network: "shelbynet" | "testnet";
    paymentModuleAddress?: `0x${string}`;
    registerFunction?: string;
    payFunction?: string;
    storageCoinType?: string;
    aptRequired: boolean;
    reason?: string;
  }

  export function readShelbyDirectPaymentCapabilities(
    env?: NodeJS.ProcessEnv,
  ): ShelbyDirectPaymentCapabilities;

  export function requireShelbyDirectPaymentCapabilities(
    env?: NodeJS.ProcessEnv,
  ): ShelbyDirectPaymentCapabilities;
  ```
- Consumes: `process.env.SHELBY_NETWORK`, `process.env.SHELBY_DIRECT_PAYMENT_MODULE_ADDRESS`, `process.env.SHELBY_DIRECT_REGISTER_FUNCTION`, `process.env.SHELBY_DIRECT_PAY_FUNCTION`, `process.env.SHELBY_STORAGE_COIN_TYPE`.

- [ ] **Step 1: Write failing tests for capability detection**

Create `tests/storage/direct-payment-capabilities.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  readShelbyDirectPaymentCapabilities,
  requireShelbyDirectPaymentCapabilities,
} from "@/server/shelby/direct-payment-capabilities";

describe("Shelby direct payment capability detection", () => {
  it("reports unsupported when Shelby Move payment functions are not configured", () => {
    const capabilities = readShelbyDirectPaymentCapabilities({
      SHELBY_NETWORK: "shelbynet",
    } as NodeJS.ProcessEnv);

    expect(capabilities).toEqual({
      supported: false,
      network: "shelbynet",
      aptRequired: true,
      reason:
        "Shelby direct contract payment requires SHELBY_DIRECT_PAYMENT_MODULE_ADDRESS, SHELBY_DIRECT_REGISTER_FUNCTION, SHELBY_DIRECT_PAY_FUNCTION, and SHELBY_STORAGE_COIN_TYPE.",
    });
  });

  it("returns configured direct payment interface when all required values are present", () => {
    const capabilities = readShelbyDirectPaymentCapabilities({
      SHELBY_NETWORK: "shelbynet",
      SHELBY_DIRECT_PAYMENT_MODULE_ADDRESS: "0x1",
      SHELBY_DIRECT_REGISTER_FUNCTION: "0x1::shelby::register_blob",
      SHELBY_DIRECT_PAY_FUNCTION: "0x1::shelby::pay_storage",
      SHELBY_STORAGE_COIN_TYPE: "0x1::aptos_coin::AptosCoin",
    } as NodeJS.ProcessEnv);

    expect(capabilities).toMatchObject({
      supported: true,
      network: "shelbynet",
      paymentModuleAddress: "0x1",
      registerFunction: "0x1::shelby::register_blob",
      payFunction: "0x1::shelby::pay_storage",
      storageCoinType: "0x1::aptos_coin::AptosCoin",
      aptRequired: true,
    });
  });

  it("throws a clear protocol blocker when strict direct payment is required but unavailable", () => {
    expect(() =>
      requireShelbyDirectPaymentCapabilities({
        SHELBY_NETWORK: "shelbynet",
      } as NodeJS.ProcessEnv),
    ).toThrow(
      "Shelby direct contract payment is not configured for this environment.",
    );
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm vitest run tests/storage/direct-payment-capabilities.test.ts
```

Expected: FAIL because `src/server/shelby/direct-payment-capabilities.ts` does not exist.

- [ ] **Step 3: Implement the capability module**

Create `src/server/shelby/direct-payment-capabilities.ts`:

```ts
export interface ShelbyDirectPaymentCapabilities {
  supported: boolean;
  network: "shelbynet" | "testnet";
  paymentModuleAddress?: `0x${string}`;
  registerFunction?: string;
  payFunction?: string;
  storageCoinType?: string;
  aptRequired: boolean;
  reason?: string;
}

const MISSING_DIRECT_PAYMENT_CONFIG_REASON =
  "Shelby direct contract payment requires SHELBY_DIRECT_PAYMENT_MODULE_ADDRESS, SHELBY_DIRECT_REGISTER_FUNCTION, SHELBY_DIRECT_PAY_FUNCTION, and SHELBY_STORAGE_COIN_TYPE.";

export function readShelbyDirectPaymentCapabilities(
  env: NodeJS.ProcessEnv = process.env,
): ShelbyDirectPaymentCapabilities {
  const network = parseShelbyNetwork(env.SHELBY_NETWORK);
  const paymentModuleAddress = parseHexAddress(
    env.SHELBY_DIRECT_PAYMENT_MODULE_ADDRESS,
  );
  const registerFunction = parseFunctionId(env.SHELBY_DIRECT_REGISTER_FUNCTION);
  const payFunction = parseFunctionId(env.SHELBY_DIRECT_PAY_FUNCTION);
  const storageCoinType = parseFunctionId(env.SHELBY_STORAGE_COIN_TYPE);

  if (
    !paymentModuleAddress ||
    !registerFunction ||
    !payFunction ||
    !storageCoinType
  ) {
    return {
      supported: false,
      network,
      aptRequired: true,
      reason: MISSING_DIRECT_PAYMENT_CONFIG_REASON,
    };
  }

  return {
    supported: true,
    network,
    paymentModuleAddress,
    registerFunction,
    payFunction,
    storageCoinType,
    aptRequired: true,
  };
}

export function requireShelbyDirectPaymentCapabilities(
  env: NodeJS.ProcessEnv = process.env,
): ShelbyDirectPaymentCapabilities {
  const capabilities = readShelbyDirectPaymentCapabilities(env);
  if (!capabilities.supported) {
    throw new Error(
      `Shelby direct contract payment is not configured for this environment. ${capabilities.reason}`,
    );
  }
  return capabilities;
}

function parseShelbyNetwork(value: string | undefined): "shelbynet" | "testnet" {
  return value === "testnet" ? "testnet" : "shelbynet";
}

function parseHexAddress(value: string | undefined): `0x${string}` | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !/^0x[a-fA-F0-9]+$/.test(trimmed)) return undefined;
  return trimmed as `0x${string}`;
}

function parseFunctionId(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || !/^0x[a-fA-F0-9]+::[A-Za-z_][A-Za-z0-9_]*::[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}
```

- [ ] **Step 4: Document the strict gate**

Add to `.env.example`:

```env
SHELBY_NETWORK=shelbynet
SHELBY_DIRECT_PAYMENT_MODULE_ADDRESS=
SHELBY_DIRECT_REGISTER_FUNCTION=
SHELBY_DIRECT_PAY_FUNCTION=
SHELBY_STORAGE_COIN_TYPE=
PAYMENT_VAULT_CONTRACT_ADDRESS=
PAYMENT_VAULT_OWNER_ADDRESS=
PAYMENT_VAULT_OPERATOR_PRIVATE_KEY=
```

Add to `README.md` under setup:

```md
### Shelbynet direct payment requirement

The Payment Vault design requires public Shelbynet Move entry points that allow a third-party contract to register/pay for Shelby storage. Configure:

- `SHELBY_DIRECT_PAYMENT_MODULE_ADDRESS`
- `SHELBY_DIRECT_REGISTER_FUNCTION`
- `SHELBY_DIRECT_PAY_FUNCTION`
- `SHELBY_STORAGE_COIN_TYPE`

If these values are not available, the app must fail closed for real vault-backed uploads instead of falling back to a server-custodied wallet.
```

- [ ] **Step 5: Run the focused test**

Run:

```bash
pnpm vitest run tests/storage/direct-payment-capabilities.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/shelby/direct-payment-capabilities.ts tests/storage/direct-payment-capabilities.test.ts .env.example README.md
git commit -m "feat: gate shelby direct payment support"
```

---

### Task 2: Payment Vault TypeScript Domain Model

**Files:**
- Create: `src/server/vault/payment-vault-types.ts`
- Create: `src/server/vault/payment-vault-quote.ts`
- Create: `tests/vault/payment-vault-quote.test.ts`

**Interfaces:**
- Consumes: `RetentionCohort` from `src/domain/files.ts`.
- Produces:
  ```ts
  export type VaultUploadMode = "shared_pack" | "dedicated_blob";
  export type VaultUploadStatus = "reserved" | "registering" | "uploading" | "settled" | "failed" | "refunded" | "expired";

  export interface VaultUploadQuoteInput {
    encryptedSizeBytes: number;
    retentionDays: "30" | "90" | "365";
    mode: VaultUploadMode;
  }

  export interface VaultUploadQuote {
    encryptedSizeBytes: number;
    retentionDays: "30" | "90" | "365";
    mode: VaultUploadMode;
    estimatedShelbyFeeOctas: number;
    estimatedStorageFeeOctas: number;
    platformFeeOctas: number;
    safetyBufferOctas: number;
    totalLockedOctas: number;
    refundPolicy: "full_refund_before_success_settlement";
  }

  export function quoteVaultUpload(input: VaultUploadQuoteInput): VaultUploadQuote;
  ```

- [ ] **Step 1: Write failing quote tests**

Create `tests/vault/payment-vault-quote.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { quoteVaultUpload } from "@/server/vault/payment-vault-quote";

describe("vault upload quote", () => {
  it("quotes shared pack upload with Shelby fee, storage fee, platform fee, and buffer", () => {
    const quote = quoteVaultUpload({
      encryptedSizeBytes: 1_048_576,
      retentionDays: "90",
      mode: "shared_pack",
    });

    expect(quote).toEqual({
      encryptedSizeBytes: 1_048_576,
      retentionDays: "90",
      mode: "shared_pack",
      estimatedShelbyFeeOctas: 4_000,
      estimatedStorageFeeOctas: 196_608,
      platformFeeOctas: 10_030,
      safetyBufferOctas: 42_128,
      totalLockedOctas: 252_766,
      refundPolicy: "full_refund_before_success_settlement",
    });
  });

  it("rejects unsafe byte counts", () => {
    expect(() =>
      quoteVaultUpload({
        encryptedSizeBytes: -1,
        retentionDays: "30",
        mode: "shared_pack",
      }),
    ).toThrow("Encrypted size must be a positive safe integer");
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
pnpm vitest run tests/vault/payment-vault-quote.test.ts
```

Expected: FAIL because the vault quote files do not exist.

- [ ] **Step 3: Add vault types**

Create `src/server/vault/payment-vault-types.ts`:

```ts
export type VaultUploadMode = "shared_pack" | "dedicated_blob";

export type VaultUploadStatus =
  | "reserved"
  | "registering"
  | "uploading"
  | "settled"
  | "failed"
  | "refunded"
  | "expired";

export interface VaultUploadQuoteInput {
  encryptedSizeBytes: number;
  retentionDays: "30" | "90" | "365";
  mode: VaultUploadMode;
}

export interface VaultUploadQuote {
  encryptedSizeBytes: number;
  retentionDays: "30" | "90" | "365";
  mode: VaultUploadMode;
  estimatedShelbyFeeOctas: number;
  estimatedStorageFeeOctas: number;
  platformFeeOctas: number;
  safetyBufferOctas: number;
  totalLockedOctas: number;
  refundPolicy: "full_refund_before_success_settlement";
}

export interface VaultUploadReservation {
  requestId: string;
  userAddress: `0x${string}`;
  quote: VaultUploadQuote;
  status: VaultUploadStatus;
  transactionHash?: string;
  refundableOctas: number;
  settledOctas: number;
  ownerFeeReleasedOctas: number;
  createdAt: string;
  deadlineAt: string;
}
```

- [ ] **Step 4: Implement deterministic quote calculator**

Create `src/server/vault/payment-vault-quote.ts`:

```ts
import { DomainError } from "@/domain/errors";
import type {
  VaultUploadQuote,
  VaultUploadQuoteInput,
} from "@/server/vault/payment-vault-types";

const BASE_SHELBY_FEE_OCTAS = 4_000;
const STORAGE_OCTAS_PER_MIB_30_DAYS = 65_536;
const PLATFORM_FEE_BPS = 500;
const SAFETY_BUFFER_BPS = 2_000;

const RETENTION_MULTIPLIER: Record<VaultUploadQuoteInput["retentionDays"], number> = {
  "30": 1,
  "90": 3,
  "365": 13,
};

export function quoteVaultUpload(
  input: VaultUploadQuoteInput,
): VaultUploadQuote {
  assertPositiveSafeInteger(input.encryptedSizeBytes);

  const mib = input.encryptedSizeBytes / 1_048_576;
  const estimatedStorageFeeOctas = Math.ceil(
    mib *
      STORAGE_OCTAS_PER_MIB_30_DAYS *
      RETENTION_MULTIPLIER[input.retentionDays],
  );
  const estimatedShelbyFeeOctas = BASE_SHELBY_FEE_OCTAS;
  const subtotal = estimatedShelbyFeeOctas + estimatedStorageFeeOctas;
  const platformFeeOctas = Math.ceil((subtotal * PLATFORM_FEE_BPS) / 10_000);
  const safetyBufferOctas = Math.ceil(
    ((subtotal + platformFeeOctas) * SAFETY_BUFFER_BPS) / 10_000,
  );

  return {
    encryptedSizeBytes: input.encryptedSizeBytes,
    retentionDays: input.retentionDays,
    mode: input.mode,
    estimatedShelbyFeeOctas,
    estimatedStorageFeeOctas,
    platformFeeOctas,
    safetyBufferOctas,
    totalLockedOctas:
      estimatedShelbyFeeOctas +
      estimatedStorageFeeOctas +
      platformFeeOctas +
      safetyBufferOctas,
    refundPolicy: "full_refund_before_success_settlement",
  };
}

function assertPositiveSafeInteger(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new DomainError(
      "Encrypted size must be a positive safe integer",
      "VAULT_QUOTE_SIZE_INVALID",
    );
  }
}
```

- [ ] **Step 5: Run focused test**

Run:

```bash
pnpm vitest run tests/vault/payment-vault-quote.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/vault/payment-vault-types.ts src/server/vault/payment-vault-quote.ts tests/vault/payment-vault-quote.test.ts
git commit -m "feat: add vault upload quote model"
```

---

### Task 3: Move Payment Vault Contract

**Files:**
- Create: `contracts/payment-vault/Move.toml`
- Create: `contracts/payment-vault/sources/payment_vault.move`
- Create: `contracts/payment-vault/sources/mock_shelby_payment.move`
- Create: `contracts/payment-vault/tests/payment_vault_tests.move`
- Modify: `README.md`

**Interfaces:**
- Consumes: Quote fields from Task 2 and direct-payment capability outputs from Task 1.
- Produces Move entry functions:
  ```move
  public entry fun initialize(owner: &signer, operator: address, platform_fee_bps: u64, refund_timeout_secs: u64)
  public entry fun upload_with_payment(user: &signer, request_id: vector<u8>, encrypted_size_bytes: u64, retention_days: u64, mode: u8, blob_or_pack_name_hash: vector<u8>, commitment_root: vector<u8>, estimated_shelby_fee_octas: u64, estimated_storage_fee_octas: u64, platform_fee_octas: u64, safety_buffer_octas: u64, deadline_secs: u64)
  public entry fun mark_upload_success(operator: &signer, request_id: vector<u8>, actual_shelby_cost_octas: u64)
  public entry fun mark_upload_failed(operator: &signer, request_id: vector<u8>)
  public entry fun refund_expired_upload(user: &signer, request_id: vector<u8>)
  public entry fun withdraw_refund(user: &signer, amount_octas: u64)
  public entry fun withdraw_owner_fees(owner: &signer, amount_octas: u64)
  public entry fun set_operator(owner: &signer, operator: address)
  public entry fun set_platform_fee_bps(owner: &signer, platform_fee_bps: u64)
  public entry fun set_paused(owner: &signer, paused: bool)
  ```

- [ ] **Step 1: Add Move package scaffold**

Create `contracts/payment-vault/Move.toml`:

```toml
[package]
name = "PrivateRollupPaymentVault"
version = "0.1.0"

[addresses]
private_rollup = "_"
aptos_framework = "0x1"

[dependencies]
AptosFramework = { git = "https://github.com/aptos-labs/aptos-core.git", subdir = "aptos-move/framework/aptos-framework", rev = "mainnet" }
```

- [ ] **Step 2: Write Move tests first**

Create `contracts/payment-vault/tests/payment_vault_tests.move`:

```move
#[test_only]
module private_rollup::payment_vault_tests {
    use aptos_framework::aptos_coin;
    use aptos_framework::coin;
    use aptos_framework::account;
    use private_rollup::payment_vault;

    const OWNER: address = @0xA11CE;
    const OPERATOR: address = @0xB0B;
    const USER: address = @0xCAFE;

    fun setup(): (signer, signer, signer) {
        let owner = account::create_account_for_test(OWNER);
        let operator = account::create_account_for_test(OPERATOR);
        let user = account::create_account_for_test(USER);
        aptos_coin::initialize_for_test(&owner);
        coin::register<aptos_coin::AptosCoin>(&user);
        coin::register<aptos_coin::AptosCoin>(&owner);
        coin::register<aptos_coin::AptosCoin>(&operator);
        aptos_coin::mint(&owner, USER, 1_000_000_000);
        payment_vault::initialize(&owner, OPERATOR, 500, 300);
        (owner, operator, user)
    }

    #[test]
    public fun upload_success_releases_owner_fee_and_refund() {
        let (owner, operator, user) = setup();
        payment_vault::upload_with_payment(
            &user,
            b"request-1",
            1048576,
            90,
            0,
            b"pack-name-hash",
            b"commitment-root",
            4_000,
            196_608,
            10_030,
            42_128,
            9_999_999,
        );

        payment_vault::mark_upload_success(&operator, b"request-1", 200_000);

        assert!(payment_vault::refundable_balance(USER) == 42_766, 100);
        assert!(payment_vault::owner_fee_balance() == 10_030, 101);
        payment_vault::withdraw_owner_fees(&owner, 10_030);
        payment_vault::withdraw_refund(&user, 42_766);
    }

    #[test]
    public fun upload_failure_refunds_everything_and_owner_gets_nothing() {
        let (_owner, operator, user) = setup();
        payment_vault::upload_with_payment(
            &user,
            b"request-2",
            1048576,
            90,
            0,
            b"pack-name-hash",
            b"commitment-root",
            4_000,
            196_608,
            10_030,
            42_128,
            9_999_999,
        );

        payment_vault::mark_upload_failed(&operator, b"request-2");

        assert!(payment_vault::refundable_balance(USER) == 252_766, 200);
        assert!(payment_vault::owner_fee_balance() == 0, 201);
    }

    #[test]
    #[expected_failure(abort_code = 6)]
    public fun non_operator_cannot_mark_success() {
        let (_owner, _operator, user) = setup();
        payment_vault::upload_with_payment(
            &user,
            b"request-3",
            1024,
            30,
            0,
            b"pack-name-hash",
            b"commitment-root",
            4_000,
            1_000,
            250,
            1_050,
            9_999_999,
        );
        payment_vault::mark_upload_success(&user, b"request-3", 5_000);
    }
}
```

- [ ] **Step 3: Run Move tests to verify failure**

Run:

```bash
aptos move test --package-dir contracts/payment-vault --named-addresses private_rollup=0x42
```

Expected: FAIL because `payment_vault.move` does not exist.

- [ ] **Step 4: Implement the Move contract**

Create `contracts/payment-vault/sources/payment_vault.move` with these concrete behaviors:

```move
module private_rollup::payment_vault {
    use aptos_framework::account;
    use aptos_framework::aptos_coin;
    use aptos_framework::coin;
    use aptos_framework::event;
    use aptos_framework::signer;
    use std::table::{Self, Table};
    use std::timestamp;

    const STATUS_RESERVED: u8 = 0;
    const STATUS_SETTLED: u8 = 3;
    const STATUS_FAILED: u8 = 4;
    const STATUS_EXPIRED: u8 = 6;

    const E_ALREADY_INITIALIZED: u64 = 1;
    const E_NOT_INITIALIZED: u64 = 2;
    const E_PAUSED: u64 = 3;
    const E_NOT_OWNER: u64 = 4;
    const E_DUPLICATE_REQUEST: u64 = 5;
    const E_NOT_OPERATOR: u64 = 6;
    const E_REQUEST_NOT_FOUND: u64 = 7;
    const E_NOT_SETTLEABLE: u64 = 8;
    const E_INSUFFICIENT_REFUND: u64 = 9;
    const E_ACTUAL_COST_TOO_HIGH: u64 = 10;

    struct Config has key {
        owner: address,
        operator: address,
        platform_fee_bps: u64,
        refund_timeout_secs: u64,
        paused: bool,
        vault_coins: coin::Coin<aptos_coin::AptosCoin>,
        requests: Table<vector<u8>, UploadRequest>,
        refundable_by_user: Table<address, u64>,
        owner_fee_balance: u64,
        upload_reserved_events: event::EventHandle<UploadReservedEvent>,
        upload_settled_events: event::EventHandle<UploadSettledEvent>,
        upload_failed_events: event::EventHandle<UploadFailedEvent>,
        refund_withdrawn_events: event::EventHandle<RefundWithdrawnEvent>,
    }

    struct UploadRequest has store, drop {
        user: address,
        encrypted_size_bytes: u64,
        retention_days: u64,
        mode: u8,
        blob_or_pack_name_hash: vector<u8>,
        commitment_root: vector<u8>,
        total_locked_octas: u64,
        estimated_shelby_fee_octas: u64,
        estimated_storage_fee_octas: u64,
        platform_fee_octas: u64,
        safety_buffer_octas: u64,
        paid_to_shelby_octas: u64,
        refunded_octas: u64,
        owner_fee_released_octas: u64,
        status: u8,
        created_at_secs: u64,
        deadline_secs: u64,
    }

    #[event]
    struct UploadReservedEvent has drop, store {
        request_id: vector<u8>,
        user: address,
        total_locked_octas: u64,
    }

    #[event]
    struct UploadSettledEvent has drop, store {
        request_id: vector<u8>,
        user: address,
        actual_shelby_cost_octas: u64,
        platform_fee_octas: u64,
        refund_octas: u64,
    }

    #[event]
    struct UploadFailedEvent has drop, store {
        request_id: vector<u8>,
        user: address,
        refund_octas: u64,
    }

    #[event]
    struct RefundWithdrawnEvent has drop, store {
        user: address,
        amount_octas: u64,
    }

    public entry fun initialize(
        owner: &signer,
        operator: address,
        platform_fee_bps: u64,
        refund_timeout_secs: u64,
    ) {
        let owner_address = signer::address_of(owner);
        assert!(!exists<Config>(@private_rollup), E_ALREADY_INITIALIZED);
        move_to(owner, Config {
            owner: owner_address,
            operator,
            platform_fee_bps,
            refund_timeout_secs,
            paused: false,
            vault_coins: coin::zero<aptos_coin::AptosCoin>(),
            requests: table::new<vector<u8>, UploadRequest>(),
            refundable_by_user: table::new<address, u64>(),
            owner_fee_balance: 0,
            upload_reserved_events: account::new_event_handle<UploadReservedEvent>(owner),
            upload_settled_events: account::new_event_handle<UploadSettledEvent>(owner),
            upload_failed_events: account::new_event_handle<UploadFailedEvent>(owner),
            refund_withdrawn_events: account::new_event_handle<RefundWithdrawnEvent>(owner),
        });
    }

    public entry fun upload_with_payment(
        user: &signer,
        request_id: vector<u8>,
        encrypted_size_bytes: u64,
        retention_days: u64,
        mode: u8,
        blob_or_pack_name_hash: vector<u8>,
        commitment_root: vector<u8>,
        estimated_shelby_fee_octas: u64,
        estimated_storage_fee_octas: u64,
        platform_fee_octas: u64,
        safety_buffer_octas: u64,
        deadline_secs: u64,
    ) acquires Config {
        let cfg = borrow_global_mut<Config>(@private_rollup);
        assert!(!cfg.paused, E_PAUSED);
        assert!(!table::contains(&cfg.requests, request_id), E_DUPLICATE_REQUEST);

        let total_locked_octas = estimated_shelby_fee_octas + estimated_storage_fee_octas + platform_fee_octas + safety_buffer_octas;
        let coins = coin::withdraw<aptos_coin::AptosCoin>(user, total_locked_octas);
        coin::merge(&mut cfg.vault_coins, coins);

        let user_address = signer::address_of(user);
        table::add(&mut cfg.requests, copy request_id, UploadRequest {
            user: user_address,
            encrypted_size_bytes,
            retention_days,
            mode,
            blob_or_pack_name_hash,
            commitment_root,
            total_locked_octas,
            estimated_shelby_fee_octas,
            estimated_storage_fee_octas,
            platform_fee_octas,
            safety_buffer_octas,
            paid_to_shelby_octas: 0,
            refunded_octas: 0,
            owner_fee_released_octas: 0,
            status: STATUS_RESERVED,
            created_at_secs: timestamp::now_seconds(),
            deadline_secs,
        });

        event::emit_event(&mut cfg.upload_reserved_events, UploadReservedEvent {
            request_id,
            user: user_address,
            total_locked_octas,
        });
    }

    public entry fun mark_upload_success(
        operator: &signer,
        request_id: vector<u8>,
        actual_shelby_cost_octas: u64,
    ) acquires Config {
        let cfg = borrow_global_mut<Config>(@private_rollup);
        assert!(signer::address_of(operator) == cfg.operator, E_NOT_OPERATOR);
        assert!(table::contains(&cfg.requests, request_id), E_REQUEST_NOT_FOUND);
        let request = table::borrow_mut(&mut cfg.requests, request_id);
        assert!(request.status == STATUS_RESERVED, E_NOT_SETTLEABLE);

        let spend_without_buffer = actual_shelby_cost_octas + request.platform_fee_octas;
        assert!(spend_without_buffer <= request.total_locked_octas, E_ACTUAL_COST_TOO_HIGH);
        let refund_octas = request.total_locked_octas - spend_without_buffer;

        request.paid_to_shelby_octas = actual_shelby_cost_octas;
        request.owner_fee_released_octas = request.platform_fee_octas;
        request.refunded_octas = refund_octas;
        request.status = STATUS_SETTLED;

        cfg.owner_fee_balance = cfg.owner_fee_balance + request.platform_fee_octas;
        add_refundable(cfg, request.user, refund_octas);

        event::emit_event(&mut cfg.upload_settled_events, UploadSettledEvent {
            request_id,
            user: request.user,
            actual_shelby_cost_octas,
            platform_fee_octas: request.platform_fee_octas,
            refund_octas,
        });
    }

    public entry fun mark_upload_failed(operator: &signer, request_id: vector<u8>) acquires Config {
        let cfg = borrow_global_mut<Config>(@private_rollup);
        assert!(signer::address_of(operator) == cfg.operator, E_NOT_OPERATOR);
        fail_request(cfg, request_id);
    }

    public entry fun refund_expired_upload(user: &signer, request_id: vector<u8>) acquires Config {
        let cfg = borrow_global_mut<Config>(@private_rollup);
        assert!(table::contains(&cfg.requests, request_id), E_REQUEST_NOT_FOUND);
        let request = table::borrow(&cfg.requests, request_id);
        assert!(request.user == signer::address_of(user), E_REQUEST_NOT_FOUND);
        assert!(timestamp::now_seconds() >= request.deadline_secs, E_NOT_SETTLEABLE);
        fail_request(cfg, request_id);
    }

    public entry fun withdraw_refund(user: &signer, amount_octas: u64) acquires Config {
        let cfg = borrow_global_mut<Config>(@private_rollup);
        let user_address = signer::address_of(user);
        let available = refundable_balance(user_address);
        assert!(available >= amount_octas, E_INSUFFICIENT_REFUND);
        table::upsert(&mut cfg.refundable_by_user, user_address, available - amount_octas);
        let coins = coin::extract(&mut cfg.vault_coins, amount_octas);
        coin::deposit<aptos_coin::AptosCoin>(user_address, coins);
        event::emit_event(&mut cfg.refund_withdrawn_events, RefundWithdrawnEvent { user: user_address, amount_octas });
    }

    public entry fun withdraw_owner_fees(owner: &signer, amount_octas: u64) acquires Config {
        let cfg = borrow_global_mut<Config>(@private_rollup);
        assert!(signer::address_of(owner) == cfg.owner, E_NOT_OWNER);
        assert!(cfg.owner_fee_balance >= amount_octas, E_INSUFFICIENT_REFUND);
        cfg.owner_fee_balance = cfg.owner_fee_balance - amount_octas;
        let coins = coin::extract(&mut cfg.vault_coins, amount_octas);
        coin::deposit<aptos_coin::AptosCoin>(cfg.owner, coins);
    }

    public fun refundable_balance(user: address): u64 acquires Config {
        let cfg = borrow_global<Config>(@private_rollup);
        if (table::contains(&cfg.refundable_by_user, user)) {
            *table::borrow(&cfg.refundable_by_user, user)
        } else {
            0
        }
    }

    public fun owner_fee_balance(): u64 acquires Config {
        borrow_global<Config>(@private_rollup).owner_fee_balance
    }

    fun fail_request(cfg: &mut Config, request_id: vector<u8>) {
        assert!(table::contains(&cfg.requests, request_id), E_REQUEST_NOT_FOUND);
        let request = table::borrow_mut(&mut cfg.requests, request_id);
        assert!(request.status == STATUS_RESERVED, E_NOT_SETTLEABLE);
        request.status = STATUS_FAILED;
        request.refunded_octas = request.total_locked_octas;
        add_refundable(cfg, request.user, request.total_locked_octas);
        event::emit_event(&mut cfg.upload_failed_events, UploadFailedEvent {
            request_id,
            user: request.user,
            refund_octas: request.total_locked_octas,
        });
    }

    fun add_refundable(cfg: &mut Config, user: address, amount: u64) {
        if (amount == 0) return;
        let current = if (table::contains(&cfg.refundable_by_user, user)) {
            *table::borrow(&cfg.refundable_by_user, user)
        } else {
            0
        };
        table::upsert(&mut cfg.refundable_by_user, user, current + amount);
    }
}
```

- [ ] **Step 5: Run Move tests**

Run:

```bash
aptos move test --package-dir contracts/payment-vault --named-addresses private_rollup=0x42
```

Expected: PASS for success settlement, failed refund, and permission tests.

- [ ] **Step 6: Commit**

```bash
git add contracts/payment-vault README.md
git commit -m "feat: add payment vault move contract"
```

---

### Task 4: Vault Database Index and API Client

**Files:**
- Modify: `src/server/db/schema.ts`
- Create: `src/server/vault/payment-vault-client.ts`
- Create: `tests/vault/payment-vault-client.test.ts`
- Create: `src/app/api/payment-vault/quote/route.ts`
- Create: `src/app/api/payment-vault/status/route.ts`
- Create: `tests/vault/payment-vault-routes.test.ts`

**Interfaces:**
- Consumes: `VaultUploadQuote` from Task 2 and contract function names from Task 3.
- Produces:
  ```ts
  export interface BuildUploadPaymentPayloadInput {
    requestId: string;
    quote: VaultUploadQuote;
    userAddress: `0x${string}`;
    blobOrPackNameHash: string;
    commitmentRoot: string;
    deadlineAt: string;
  }

  export class PaymentVaultClient {
    buildUploadWithPaymentPayload(input: BuildUploadPaymentPayloadInput): InputTransactionData;
    buildWithdrawRefundPayload(amountOctas: number): InputTransactionData;
    getReservation(requestId: string): Promise<VaultUploadReservation | undefined>;
  }
  ```

- [ ] **Step 1: Write transaction payload tests**

Create `tests/vault/payment-vault-client.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PaymentVaultClient } from "@/server/vault/payment-vault-client";

describe("PaymentVaultClient", () => {
  it("builds upload_with_payment payload against the configured vault", () => {
    const client = new PaymentVaultClient({
      contractAddress: "0x42",
      network: "shelbynet",
    });

    const payload = client.buildUploadWithPaymentPayload({
      requestId: "req_123",
      userAddress: "0xabc",
      blobOrPackNameHash: "aa".repeat(32),
      commitmentRoot: "bb".repeat(32),
      deadlineAt: "2026-08-05T10:05:00.000Z",
      quote: {
        encryptedSizeBytes: 1_048_576,
        retentionDays: "90",
        mode: "shared_pack",
        estimatedShelbyFeeOctas: 4_000,
        estimatedStorageFeeOctas: 196_608,
        platformFeeOctas: 10_030,
        safetyBufferOctas: 42_128,
        totalLockedOctas: 252_766,
        refundPolicy: "full_refund_before_success_settlement",
      },
    });

    expect(payload.data.function).toBe("0x42::payment_vault::upload_with_payment");
    expect(payload.data.functionArguments).toContain(252_766);
  });
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm vitest run tests/vault/payment-vault-client.test.ts
```

Expected: FAIL because `PaymentVaultClient` does not exist.

- [ ] **Step 3: Implement client wrapper**

Create `src/server/vault/payment-vault-client.ts`:

```ts
import type { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import type {
  VaultUploadQuote,
  VaultUploadReservation,
} from "@/server/vault/payment-vault-types";

export interface PaymentVaultClientConfig {
  contractAddress: `0x${string}`;
  network: "shelbynet" | "testnet";
}

export interface BuildUploadPaymentPayloadInput {
  requestId: string;
  quote: VaultUploadQuote;
  userAddress: `0x${string}`;
  blobOrPackNameHash: string;
  commitmentRoot: string;
  deadlineAt: string;
}

export class PaymentVaultClient {
  constructor(private readonly config: PaymentVaultClientConfig) {}

  buildUploadWithPaymentPayload(
    input: BuildUploadPaymentPayloadInput,
  ): InputTransactionData {
    return {
      data: {
        function: `${this.config.contractAddress}::payment_vault::upload_with_payment`,
        functionArguments: [
          new TextEncoder().encode(input.requestId),
          input.quote.encryptedSizeBytes,
          Number(input.quote.retentionDays),
          input.quote.mode === "shared_pack" ? 0 : 1,
          hexToBytes(input.blobOrPackNameHash),
          hexToBytes(input.commitmentRoot),
          input.quote.estimatedShelbyFeeOctas,
          input.quote.estimatedStorageFeeOctas,
          input.quote.platformFeeOctas,
          input.quote.safetyBufferOctas,
          Math.floor(new Date(input.deadlineAt).getTime() / 1000),
        ],
      },
    };
  }

  buildWithdrawRefundPayload(amountOctas: number): InputTransactionData {
    return {
      data: {
        function: `${this.config.contractAddress}::payment_vault::withdraw_refund`,
        functionArguments: [amountOctas],
      },
    };
  }

  async getReservation(_requestId: string): Promise<VaultUploadReservation | undefined> {
    return undefined;
  }
}

function hexToBytes(hex: string) {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!/^[a-fA-F0-9]*$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error("Hex value is invalid");
  }
  return Uint8Array.from(clean.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
}
```

- [ ] **Step 4: Add DB index tables**

Modify `src/server/db/schema.ts` by adding:

```ts
export const vaultUploadStatusEnum = pgEnum("vault_upload_status", [
  "reserved",
  "registering",
  "uploading",
  "settled",
  "failed",
  "refunded",
  "expired",
]);

export const vaultUploadRequests = pgTable(
  "vault_upload_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    uploadBatchId: uuid("upload_batch_id").references(() => uploadBatches.id),
    requestId: text("request_id").notNull(),
    userAddress: text("user_address").notNull(),
    contractAddress: text("contract_address").notNull(),
    status: vaultUploadStatusEnum("status").notNull(),
    encryptedSizeBytes: bigint("encrypted_size_bytes", { mode: "number" }).notNull(),
    retentionDays: retentionCohortEnum("retention_days").notNull(),
    mode: packStrategyEnum("mode").notNull(),
    estimatedShelbyFeeOctas: bigint("estimated_shelby_fee_octas", { mode: "number" }).notNull(),
    estimatedStorageFeeOctas: bigint("estimated_storage_fee_octas", { mode: "number" }).notNull(),
    platformFeeOctas: bigint("platform_fee_octas", { mode: "number" }).notNull(),
    safetyBufferOctas: bigint("safety_buffer_octas", { mode: "number" }).notNull(),
    totalLockedOctas: bigint("total_locked_octas", { mode: "number" }).notNull(),
    actualShelbyCostOctas: bigint("actual_shelby_cost_octas", { mode: "number" }),
    refundableOctas: bigint("refundable_octas", { mode: "number" }).notNull().default(0),
    transactionHash: text("transaction_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("vault_upload_requests_request_id_unique").on(table.requestId),
    index("vault_upload_requests_user_status_idx").on(table.userId, table.status),
  ],
);
```

Add `vaultUploadRequests` to `schemaTables`.

- [ ] **Step 5: Add quote/status API tests and routes**

Create `tests/vault/payment-vault-routes.test.ts` with route-level tests that assert:

```ts
expect(response.status).toBe(200);
expect(await response.json()).toMatchObject({
  quote: {
    totalLockedOctas: expect.any(Number),
    refundPolicy: "full_refund_before_success_settlement",
  },
  payment: {
    payer: "connected_wallet",
    receiver: "payment_vault_contract",
  },
});
```

Create `src/app/api/payment-vault/quote/route.ts` returning a quote from `quoteVaultUpload`.

Create `src/app/api/payment-vault/status/route.ts` returning current reservation state from the DB index.

- [ ] **Step 6: Run verification**

Run:

```bash
pnpm vitest run tests/vault/payment-vault-client.test.ts tests/vault/payment-vault-routes.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/db/schema.ts src/server/vault src/app/api/payment-vault tests/vault
git commit -m "feat: add payment vault api client"
```

---

### Task 5: Upload Reservation Gate

**Files:**
- Modify: `src/server/uploads/service.ts`
- Modify: `src/app/api/uploads/route.ts`
- Create: `src/server/vault/payment-vault-service.ts`
- Modify: `tests/uploads/uploads-service.test.ts`
- Modify: `tests/uploads/upload-routes.test.ts`

**Interfaces:**
- Consumes: `PaymentVaultClient`, `VaultUploadQuote`, `VaultUploadReservation`.
- Produces:
  ```ts
  export interface CreateVaultBackedUploadInput {
    userId: string;
    userAddress: `0x${string}`;
    idempotencyKey: string;
    retentionDays: "30" | "90" | "365";
    items: CreateUploadItemInput[];
    reservationTransactionHash: string;
    vaultRequestId: string;
  }

  export async function assertVaultReservationReady(input: {
    userId: string;
    userAddress: `0x${string}`;
    vaultRequestId: string;
    expectedEncryptedBytes: number;
    expectedRetentionDays: "30" | "90" | "365";
  }): Promise<void>;
  ```

- [ ] **Step 1: Write failing upload service test**

Add to `tests/uploads/uploads-service.test.ts`:

```ts
it("rejects upload creation when the vault reservation is missing", async () => {
  await expect(
    createUploadBatch({
      userId: "wallet:user-without-vault-reservation",
      idempotencyKey: "missing-vault-reservation",
      retentionDays: "90",
      items: [validEncryptedUploadItem()],
      vaultRequestId: "vault_req_missing",
      reservationTransactionHash: "0xmissing",
      userAddress: "0xabc",
    }),
  ).rejects.toMatchObject({
    code: "VAULT_RESERVATION_REQUIRED",
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
pnpm vitest run tests/uploads/uploads-service.test.ts
```

Expected: FAIL because upload service does not require a vault reservation.

- [ ] **Step 3: Implement vault service**

Create `src/server/vault/payment-vault-service.ts`:

```ts
import { DomainError } from "@/domain/errors";
import { quoteVaultUpload } from "@/server/vault/payment-vault-quote";

export async function assertVaultReservationReady(input: {
  userId: string;
  userAddress: `0x${string}`;
  vaultRequestId: string;
  expectedEncryptedBytes: number;
  expectedRetentionDays: "30" | "90" | "365";
}) {
  if (!input.vaultRequestId.trim()) {
    throw new DomainError(
      "Payment Vault reservation is required before upload",
      "VAULT_RESERVATION_REQUIRED",
    );
  }

  quoteVaultUpload({
    encryptedSizeBytes: input.expectedEncryptedBytes,
    retentionDays: input.expectedRetentionDays,
    mode: input.expectedEncryptedBytes < 10 * 1024 * 1024
      ? "shared_pack"
      : "dedicated_blob",
  });
}
```

- [ ] **Step 4: Modify upload creation to require reservation metadata**

Modify `src/server/uploads/service.ts`:

```ts
export interface CreateUploadBatchInput {
  userId: string;
  userAddress: `0x${string}`;
  idempotencyKey: string;
  retentionDays: RetentionCohort;
  vaultRequestId: string;
  reservationTransactionHash: string;
  items: CreateUploadItemInput[];
}
```

In `createUploadBatch`, after `totalCiphertextSizeBytes` is calculated and before batch persistence:

```ts
await assertVaultReservationReady({
  userId: input.userId,
  userAddress: input.userAddress,
  vaultRequestId: input.vaultRequestId,
  expectedEncryptedBytes: totalCiphertextSizeBytes,
  expectedRetentionDays: retentionDays,
});
```

Remove the call to `reserveUploadApt` for new vault-backed uploads. Keep `billing` optional and set it from vault-index state after Task 6.

- [ ] **Step 5: Update upload route**

Modify `src/app/api/uploads/route.ts` request schema to require:

```ts
vaultRequestId: z.string().min(1),
reservationTransactionHash: z.string().regex(/^0x[a-fA-F0-9]+$/),
userAddress: z.string().regex(/^0x[a-fA-F0-9]+$/),
```

Return HTTP 402-style JSON only when vault reservation is missing:

```json
{
  "error": "Payment Vault reservation is required before upload",
  "code": "VAULT_RESERVATION_REQUIRED"
}
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm vitest run tests/uploads/uploads-service.test.ts tests/uploads/upload-routes.test.ts
```

Expected: PASS after tests are updated to include vault reservation fields for successful cases.

- [ ] **Step 7: Commit**

```bash
git add src/server/uploads/service.ts src/app/api/uploads/route.ts src/server/vault/payment-vault-service.ts tests/uploads
git commit -m "feat: require vault reservation for uploads"
```

---

### Task 6: Pack Settlement Through Vault Contract

**Files:**
- Modify: `src/server/packs/worker.ts`
- Modify: `src/server/packs/shared-pack.ts`
- Modify: `tests/packs/shared-pack.test.ts`
- Modify: `tests/packs/pack-pool-summary.test.ts`
- Create: `tests/vault/pack-vault-settlement.test.ts`

**Interfaces:**
- Consumes:
  ```ts
  PaymentVaultClient.buildMarkUploadSuccessPayload(...)
  PaymentVaultClient.buildMarkUploadFailedPayload(...)
  ```
- Produces pack settlement states in API/UI:
  ```ts
  type PackPaymentStatus = "collecting" | "closing" | "uploading" | "settling" | "settled" | "failed" | "refundable";
  ```

- [ ] **Step 1: Write failing pack settlement test**

Create `tests/vault/pack-vault-settlement.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { settlePackWithVault } from "@/server/packs/worker";

describe("pack vault settlement", () => {
  it("settles successful pack members through the Payment Vault instead of local APT balances", async () => {
    const vault = {
      markUploadSuccess: vi.fn().mockResolvedValue({ transactionHash: "0xsettled" }),
    };

    const result = await settlePackWithVault({
      vault,
      packId: "pack_1",
      totalCostOctas: 80_000,
      members: [
        { vaultRequestId: "req_a", ciphertextBytes: 1_000 },
        { vaultRequestId: "req_b", ciphertextBytes: 3_000 },
      ],
    });

    expect(vault.markUploadSuccess).toHaveBeenCalledWith({
      requestId: "req_a",
      actualShelbyCostOctas: 20_000,
    });
    expect(vault.markUploadSuccess).toHaveBeenCalledWith({
      requestId: "req_b",
      actualShelbyCostOctas: 60_000,
    });
    expect(result.status).toBe("settled");
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
pnpm vitest run tests/vault/pack-vault-settlement.test.ts
```

Expected: FAIL because `settlePackWithVault` does not exist.

- [ ] **Step 3: Implement byte-based vault settlement helper**

Modify `src/server/packs/worker.ts`:

```ts
export async function settlePackWithVault(input: {
  vault: {
    markUploadSuccess(args: {
      requestId: string;
      actualShelbyCostOctas: number;
    }): Promise<{ transactionHash: string }>;
  };
  packId: string;
  totalCostOctas: number;
  members: Array<{
    vaultRequestId: string;
    ciphertextBytes: number;
  }>;
}) {
  const totalBytes = input.members.reduce(
    (sum, member) => sum + member.ciphertextBytes,
    0,
  );
  if (totalBytes <= 0) throw new Error("Pack has no billable bytes");

  const settlements = [];
  let allocated = 0;
  for (const [index, member] of input.members.entries()) {
    const cost =
      index === input.members.length - 1
        ? input.totalCostOctas - allocated
        : Math.floor(
            (input.totalCostOctas * member.ciphertextBytes) / totalBytes,
          );
    allocated += cost;
    settlements.push(
      await input.vault.markUploadSuccess({
        requestId: member.vaultRequestId,
        actualShelbyCostOctas: cost,
      }),
    );
  }

  return {
    packId: input.packId,
    status: "settled" as const,
    settlements,
  };
}
```

- [ ] **Step 4: Replace local APT settlement path in worker**

In `src/server/packs/worker.ts`, replace the current `settlePackCostByBytes` call with `settlePackWithVault` after Shelby write success. If `settlePackWithVault` fails, mark pack as `retrying` and do not mark user uploads `available`.

- [ ] **Step 5: Update pool summary to expose settlement states**

Modify `src/server/packs/pool-summary.ts` and tests so each pool includes:

```ts
paymentStatus: "collecting" | "closing" | "uploading" | "settling" | "settled" | "failed" | "refundable";
targetBytes: number;
maxWaitSeconds: number;
oldestBatchAgeSeconds: number;
timeUntilForcedCloseSeconds: number;
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm vitest run tests/vault/pack-vault-settlement.test.ts tests/packs/shared-pack.test.ts tests/packs/pack-pool-summary.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/packs tests/packs tests/vault/pack-vault-settlement.test.ts
git commit -m "feat: settle pack costs through vault"
```

---

### Task 7: Frontend Upload Wizard Payment Vault Flow

**Files:**
- Modify: `src/features/upload/upload-panel.tsx`
- Create: `src/client/api/payment-vault.ts`
- Modify: `tests/uploads/upload-panel.test.tsx`

**Interfaces:**
- Consumes:
  ```ts
  getVaultUploadQuote(input): Promise<{ quote: VaultUploadQuote; payment: { payer: "connected_wallet"; receiver: "payment_vault_contract"; contractAddress: string } }>
  buildUploadWithPaymentPayload(input): InputTransactionData
  ```
- Produces user-facing flow:
  `Select files -> Review cost -> Pay and upload -> Track pack -> Settlement`.

- [ ] **Step 1: Write failing UI test for cost review**

Add to `tests/uploads/upload-panel.test.tsx`:

```tsx
it("shows Payment Vault quote and does not mention service wallet credit", async () => {
  render(<UploadPanel />);

  await userEvent.upload(
    screen.getByLabelText(/select files/i),
    new File(["encrypted demo"], "demo.txt", { type: "text/plain" }),
  );

  expect(await screen.findByText("Review upload cost")).toBeInTheDocument();
  expect(screen.getByText("Shelby upload fee")).toBeInTheDocument();
  expect(screen.getByText("Storage fee")).toBeInTheDocument();
  expect(screen.getByText("Platform fee")).toBeInTheDocument();
  expect(screen.getByText("Safety buffer")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /pay and upload/i })).toBeEnabled();
  expect(screen.queryByText(/service wallet/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/credit/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run failing UI test**

Run:

```bash
pnpm vitest run tests/uploads/upload-panel.test.tsx
```

Expected: FAIL because upload panel still shows service-wallet balance/deposit copy.

- [ ] **Step 3: Add vault API client**

Create `src/client/api/payment-vault.ts`:

```ts
import type { VaultUploadQuote } from "@/server/vault/payment-vault-types";

export async function getVaultUploadQuote(input: {
  encryptedSizeBytes: number;
  retentionDays: "30" | "90" | "365";
  mode: "shared_pack" | "dedicated_blob";
}): Promise<{
  quote: VaultUploadQuote;
  payment: {
    payer: "connected_wallet";
    receiver: "payment_vault_contract";
    contractAddress: string;
  };
}> {
  const response = await fetch("/api/payment-vault/quote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("Payment Vault quote failed");
  return response.json();
}
```

- [ ] **Step 4: Modify upload wizard**

In `src/features/upload/upload-panel.tsx`:

- replace service wallet balance block with `Review upload cost`;
- remove `Deposit ... APT` CTA;
- use a single `Pay and upload` CTA;
- call `signAndSubmitTransaction` with `upload_with_payment` payload;
- after transaction hash, call `/api/uploads` with `vaultRequestId`, `reservationTransactionHash`, and `userAddress`;
- show:

```text
The Payment Vault pays Shelby.
The platform fee is charged only after the upload succeeds.
If upload fails before settlement, your locked amount is refundable.
```

- [ ] **Step 5: Run focused UI tests**

Run:

```bash
pnpm vitest run tests/uploads/upload-panel.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/upload/upload-panel.tsx src/client/api/payment-vault.ts tests/uploads/upload-panel.test.tsx
git commit -m "feat: add vault-backed upload wizard"
```

---

### Task 8: Header, Billing, Packs, and Documentation UX

**Files:**
- Modify: `src/components/app-shell/connected-wallet-badge.tsx`
- Modify: `src/features/billing/apt-balance-panel.tsx`
- Modify: `src/app/app/packs/page.tsx`
- Modify: `src/app/app/recovery/page.tsx`
- Modify: documentation page component under `src/app` or `src/features/documentation`
- Modify: `tests/auth/app-shell.test.tsx`
- Modify: `tests/billing/apt-balance-panel.test.tsx`
- Modify: `tests/packs/packs-page.test.tsx`
- Modify: `tests/documentation/*`

**Interfaces:**
- Consumes: Payment Vault status API from Task 4 and pack payment status from Task 6.
- Produces English-only user education for Payment Vault, pack conditions, refunds, and CLI recovery.

- [ ] **Step 1: Write failing header/billing tests**

Add assertions:

```tsx
expect(screen.getByText("Connected wallet")).toBeInTheDocument();
expect(screen.getByText("Payment Vault")).toBeInTheDocument();
expect(screen.getByText("Reserved for pending uploads")).toBeInTheDocument();
expect(screen.getByText("Refundable")).toBeInTheDocument();
expect(screen.queryByText(/service wallet/i)).not.toBeInTheDocument();
expect(screen.queryByText(/credit/i)).not.toBeInTheDocument();
```

- [ ] **Step 2: Write failing packs page tests**

Assert each pool card shows:

```tsx
expect(screen.getByText("Uploads when")).toBeInTheDocument();
expect(screen.getByText(/8.0 MiB/i)).toBeInTheDocument();
expect(screen.getByText(/5 minutes/i)).toBeInTheDocument();
expect(screen.getByText("Your reserved share")).toBeInTheDocument();
expect(screen.getByText("Settlement status")).toBeInTheDocument();
```

- [ ] **Step 3: Write failing documentation tests**

Assert documentation includes:

```tsx
expect(screen.getByText("Payment Vault contract")).toBeInTheDocument();
expect(screen.getByText("How upload payment works")).toBeInTheDocument();
expect(screen.getByText("How to recover files without this webapp")).toBeInTheDocument();
expect(screen.getByText("How to claim a refund")).toBeInTheDocument();
expect(screen.getAllByRole("button", { name: /copy/i }).length).toBeGreaterThan(2);
```

- [ ] **Step 4: Run failing tests**

Run:

```bash
pnpm vitest run tests/auth/app-shell.test.tsx tests/billing/apt-balance-panel.test.tsx tests/packs/packs-page.test.tsx tests/documentation
```

Expected: FAIL because UI still uses service-wallet concepts and docs are incomplete.

- [ ] **Step 5: Implement UI copy and layout**

Update UI with these exact user-facing sections:

```text
Connected wallet
Your browser wallet signs login, upload payment, and refund withdrawal transactions.

Payment Vault
This Shelbynet smart contract receives upload payments and pays Shelby. The platform fee is released only after upload success.

Reserved for pending uploads
Funds locked for uploads waiting for pack close or Shelby settlement.

Refundable
Funds you can withdraw back to your connected wallet.
```

Documentation must include copy buttons for:

```bash
private-rollup recovery import ./recovery-kit.json
private-rollup files list --receipts ./receipts
private-rollup files pull <file-id> --receipt ./receipt.json --output ./restored
aptos move run --function-id <vault>::payment_vault::withdraw_refund --args u64:<amount_octas>
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm vitest run tests/auth/app-shell.test.tsx tests/billing/apt-balance-panel.test.tsx tests/packs/packs-page.test.tsx tests/documentation
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components src/features src/app tests
git commit -m "feat: explain payment vault user flow"
```

---

### Task 9: End-to-End Product Verification

**Files:**
- Create: `e2e/payment-vault-upload.spec.ts`
- Modify: `playwright.config.ts` only if a new env value must be passed into E2E tests.
- Modify: `docs/superpowers/plans/2026-08-05-shelbynet-payment-vault-direct-settlement.md` by checking off completed boxes during execution.

**Interfaces:**
- Consumes all previous tasks.
- Produces verified production-like flow.

- [ ] **Step 1: Add E2E test for strict gate**

Create `e2e/payment-vault-upload.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("explains Payment Vault and blocks real upload when Shelby direct payment is unavailable", async ({ page }) => {
  await page.goto("/app/upload");
  await expect(page.getByText("Payment Vault")).toBeVisible();
  await expect(page.getByText("The Payment Vault pays Shelby.")).toBeVisible();

  if (!process.env.SHELBY_DIRECT_PAYMENT_MODULE_ADDRESS) {
    await expect(
      page.getByText("Shelby direct contract payment is not configured"),
    ).toBeVisible();
  }
});
```

- [ ] **Step 2: Add E2E happy path for configured Shelbynet**

Extend the same file:

```ts
test("uploads encrypted file through vault-backed payment when Shelbynet direct payment is configured", async ({ page }) => {
  test.skip(!process.env.PAYMENT_VAULT_CONTRACT_ADDRESS, "Payment Vault contract is not deployed");
  test.skip(!process.env.SHELBY_DIRECT_PAYMENT_MODULE_ADDRESS, "Shelby direct payment interface is not configured");

  await page.goto("/app/upload");
  await page.setInputFiles('input[type="file"]', {
    name: "vault-e2e.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("vault e2e encrypted upload source"),
  });

  await expect(page.getByText("Review upload cost")).toBeVisible();
  await page.getByRole("button", { name: "Pay and upload" }).click();
  await expect(page.getByText("Upload reserved")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Settlement status")).toBeVisible();
});
```

- [ ] **Step 3: Run complete local verification**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Expected: all commands PASS.

- [ ] **Step 4: Run browser verification**

Run:

```bash
pnpm test:e2e e2e/payment-vault-upload.spec.ts
```

Expected:

- If Shelby direct payment env is missing: strict gate test PASS, happy path SKIP.
- If Shelby direct payment env is configured and contract deployed: strict gate test PASS, happy path PASS.

- [ ] **Step 5: Deploy and verify production**

Run:

```bash
git push origin main
vercel --prod --yes
```

Then verify in Chrome:

- connect wallet;
- open Upload;
- select a small file;
- review quote;
- confirm Payment Vault contract address;
- sign upload payment;
- confirm transaction hash;
- confirm pack/pool progress;
- confirm Shelby blob/pack appears in Explorer or SDK list;
- confirm owner platform fee is released only after success;
- confirm failure/refund path on a controlled failing upload.

- [ ] **Step 6: Commit final plan checkbox updates**

```bash
git add docs/superpowers/plans/2026-08-05-shelbynet-payment-vault-direct-settlement.md
git commit -m "docs: record payment vault implementation progress"
```

---

## Self-Review

- Spec coverage: covered contract custody, direct Shelby payment dependency, no off-chain credits, no server-held user funds, upload quote, platform fee only on success, failed-upload refund, frontend copy, pack pool conditions, and direct recovery/refund documentation.
- Placeholder scan: the plan intentionally contains a protocol gate instead of vague future work; implementation must stop if Shelby direct payment interfaces are not available.
- Type consistency: `VaultUploadQuote`, `VaultUploadReservation`, `PaymentVaultClient`, and `PaymentVault` function names are consistent across tasks.
- Risk note: the Move contract task includes one framework-sensitive area: vault-owned coin withdrawal. The implementation must use the Aptos-supported resource-account signer pattern if direct signer capability APIs differ in the installed Aptos framework.
