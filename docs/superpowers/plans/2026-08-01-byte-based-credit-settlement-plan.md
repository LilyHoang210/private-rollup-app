# Byte-Based Credit Settlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add prepaid credit accounting where uploads reserve estimated credit and closed packs settle real costs by each user's encrypted byte contribution.

**Architecture:** Keep accounting independent from Shelby writer execution. Upload creation reserves credit from the connected wallet-scoped user account; pack settlement uses integer microcredits and encrypted bytes to allocate final pack cost without floating-point drift. UI surfaces balance, reserved credit, estimated upload reserve, and per-batch billing state without claiming real payment or Shelby settlement until a real payment/Shelby worker is connected.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Testing Library.

## Global Constraints

- 100% user-facing website copy must be English.
- Plaintext file bytes must not be sent to the backend.
- Do not claim real money deposit, real Shelby fee, or on-chain settlement without external transaction evidence.
- Use integer microcredits for accounting.
- Split pack cost by encrypted bytes: `memberCost = totalPackCost * memberCiphertextBytes / totalPackCiphertextBytes`.

---

### Task 1: Domain Credit Math

**Files:**
- Create: `src/domain/credits.ts`
- Test: `tests/domain/credits.test.ts`

**Interfaces:**
- Produces:
  - `MICROCREDITS_PER_CREDIT: 1_000_000`
  - `estimateReserveMicrocredits({ ciphertextBytes, retentionDays })`
  - `allocatePackCostByBytes({ totalCostMicrocredits, members })`
  - `formatCredits(microcredits)`

- [x] **Step 1: Write failing tests**
  - Reserve estimate increases with bytes and retention.
  - Pack cost allocation by bytes sums exactly to total cost.
  - Zero-byte packs are rejected.

- [x] **Step 2: Run focused test to verify RED**
  - Run: `pnpm vitest run tests/domain/credits.test.ts`

- [x] **Step 3: Implement domain math**
  - Use integer `bigint` internally where multiplication can overflow.
  - Distribute remainder by largest contribution to keep allocation exact.

- [x] **Step 4: Run focused test to verify GREEN**
  - Run: `pnpm vitest run tests/domain/credits.test.ts`

### Task 2: Server Credit Ledger

**Files:**
- Create: `src/server/billing/credit-service.ts`
- Modify: `src/server/uploads/service.ts`
- Test: `tests/billing/credit-service.test.ts`
- Modify: `tests/uploads/upload-routes.test.ts`

**Interfaces:**
- Produces:
  - `getCreditAccount(userId)`
  - `reserveUploadCredit({ userId, uploadId, ciphertextBytes, retentionDays })`
  - `settlePackCostByBytes({ packId, totalCostMicrocredits, members })`
  - `resetCreditStoreForTests()`
- Consumes: upload batch `userId`, `batchId`, `totalCiphertextSizeBytes`, `retentionDays`.

- [x] **Step 1: Write failing tests**
  - New user gets a testnet credit grant.
  - Reserve reduces available credit and attaches billing state to upload API response.
  - Settlement charges by encrypted bytes and releases reserve.

- [x] **Step 2: Run focused tests to verify RED**
  - Run: `pnpm vitest run tests/billing/credit-service.test.ts tests/uploads/upload-routes.test.ts`

- [x] **Step 3: Implement ledger**
  - Keep in-memory store with explicit reset for tests.
  - Reserve on upload creation.
  - Include `billing` field in cloned upload batches.

- [x] **Step 4: Run focused tests to verify GREEN**
  - Run: `pnpm vitest run tests/billing/credit-service.test.ts tests/uploads/upload-routes.test.ts`

### Task 3: Credit API and UI

**Files:**
- Create: `src/client/api/credits.ts`
- Create: `src/app/api/credits/route.ts`
- Create: `src/features/billing/credit-balance-panel.tsx`
- Modify: `src/app/app/page.tsx`
- Modify: `src/features/upload/upload-panel.tsx`
- Modify: `src/features/uploads/upload-activity.tsx`
- Test: `tests/billing/credit-routes.test.ts`
- Test: `tests/dashboard/dashboard-content.test.tsx`
- Test: `tests/uploads/upload-panel.test.tsx`
- Test: `tests/packs/packs-page.test.tsx`

**Interfaces:**
- Produces:
  - `getCreditAccount()` client API.
  - Dashboard credit balance panel.
  - Upload reserve estimate copy.
  - Batch billing facts in Dashboard and Packs.

- [x] **Step 1: Write failing tests**
  - Authenticated `/api/credits` returns account and ledger.
  - Dashboard renders credit balance/reserved/available.
  - Upload page renders estimated reserve for selected files.
  - Packs page renders reserved credit/cost share.

- [x] **Step 2: Run focused tests to verify RED**
  - Run: `pnpm vitest run tests/billing/credit-routes.test.ts tests/dashboard/dashboard-content.test.tsx tests/uploads/upload-panel.test.tsx tests/packs/packs-page.test.tsx`

- [x] **Step 3: Implement UI and API**
  - Add credit API route.
  - Add client credit panel.
  - Add reserve estimate and billing display.

- [x] **Step 4: Run focused tests to verify GREEN**
  - Run: `pnpm vitest run tests/billing/credit-routes.test.ts tests/dashboard/dashboard-content.test.tsx tests/uploads/upload-panel.test.tsx tests/packs/packs-page.test.tsx`

### Task 4: Verification and Deployment

**Files:**
- No new production code unless verification exposes a regression.

- [ ] **Step 1: Run full checks**
  - `pnpm test`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm build`
  - `pnpm test:e2e`

- [ ] **Step 2: Commit and deploy**
  - Commit implementation.
  - Push `main`.
  - Deploy Vercel production.

- [ ] **Step 3: Chrome smoke test**
  - Open Dashboard and verify credit panel.
  - Upload small file and verify reserve/billing state.
  - Open Packs and verify cost share/reserved credit display.
