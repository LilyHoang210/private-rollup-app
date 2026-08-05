# Service Wallet Balance And Deposit UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show only the service wallet balance for upload-paying funds and support direct missing-APT deposit from the Upload page.

**Architecture:** Reuse the existing `/api/apt-account` and `/api/apt-account/sync` APIs. Move the header wallet details from connected-wallet balance lookup to service-wallet account lookup. Extract the existing deposit transaction/polling flow into a small reusable client module so both Dashboard and Upload can deposit to the service wallet without duplicating wallet adapter code.

**Tech Stack:** Next.js App Router, React client components, Aptos wallet adapter, Vitest/jsdom.

## Global Constraints

- All website copy remains English.
- The connected Aptos extension wallet is used for login, approving deposits, and receiving withdrawals.
- The webapp service wallet is the wallet that pays upload, pack, Shelby, and Aptos gas fees.
- UI must not label the connected extension wallet balance as the upload-paying balance.
- Upload eligibility must use service wallet `availableOctas`.
- The primary deposit workflow must auto-sync after wallet approval.
- Do not show `I have deposited - sync` as a primary action.

---

### Task 1: Reusable Service Wallet Deposit Client

**Files:**
- Create: `src/client/aptos/deposit.ts`
- Modify: `src/features/billing/apt-balance-panel.tsx`
- Test: `tests/billing/apt-balance-panel.test.tsx`

**Interfaces:**
- Produces `buildDepositTransaction({ recipientAddress, amountOctas }): InputTransactionData`.
- Produces `depositToServiceWallet({ amountOctas, recipientAddress, previousBalanceOctas, signAndSubmitTransaction, syncDeposits, waitMs? }): Promise<{ account: AptAccountResponse; transactionHash: string }>`

- [x] Write a focused failing test that Dashboard deposit still auto-syncs after wallet approval.
- [x] Extract transaction building and auto-sync polling from `AptBalancePanel`.
- [x] Run `pnpm vitest run tests/billing/apt-balance-panel.test.tsx`.

### Task 2: Header Wallet Details Shows Service Wallet

**Files:**
- Modify: `src/components/app-shell/connected-wallet-badge.tsx`
- Test: `tests/auth/app-shell.test.tsx`

**Interfaces:**
- Consumes `getAptAccount()`.
- Connected wallet details omit connected wallet balance.
- Webapp service wallet details show address, available, reserved, total balance, copy address, and explorer link.

- [x] Write a failing test that the dialog does not show connected wallet balance and does show service wallet details.
- [x] Replace connected-wallet balance fetching with service-wallet account fetching.
- [x] Run `pnpm vitest run tests/auth/app-shell.test.tsx`.

### Task 3: Upload Missing-APT Deposit CTA

**Files:**
- Modify: `src/features/upload/upload-panel.tsx`
- Test: `tests/uploads/upload-panel.test.tsx`

**Interfaces:**
- Consumes `depositToServiceWallet`.
- Missing APT state shows `Deposit <missing amount>` when service wallet balance is too low.
- After deposit auto-sync returns enough APT, upload button becomes enabled.

- [x] Write a failing test for exact missing-APT deposit CTA.
- [x] Write a failing test for wallet-approved deposit auto-sync enabling upload.
- [x] Implement the Upload deposit action and clearer service-wallet copy.
- [x] Run `pnpm vitest run tests/uploads/upload-panel.test.tsx`.

### Task 4: Verification And Release

**Files:**
- Review all changed files.

- [x] Run `pnpm typecheck`.
- [x] Run `pnpm lint`.
- [x] Run `pnpm test`.
- [x] Run `pnpm build`.
- [ ] Commit, push, and deploy production.
- [ ] Check production in Chrome.
