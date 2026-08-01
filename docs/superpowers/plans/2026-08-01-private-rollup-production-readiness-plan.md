# Private Rollup Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current Private Rollup app from a demo-like control plane into a truthful working MVP: wallet session controls work, upload activity remains visible across pages, pack controls function, dead header buttons are removed, and real Shelby/on-chain upload status is exposed without faking success.

**Architecture:** Keep browser-side encryption as the privacy boundary. Add a small client upload cache for immediate cross-page consistency, wire pack list filtering/sorting in the client, and add explicit storage-driver status so the UI distinguishes local queued metadata from real Shelby/on-chain registration. The real chain writer is gated by concrete Shelby SDK/gateway/contract configuration; if that configuration is absent, the product must say so clearly.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Testing Library, Playwright, Aptos wallet adapter, Aptos TS SDK, Vercel.

## Global Constraints

- 100% user-facing website copy must be English.
- The web app must not download/decrypt user files; recovery remains local CLI-oriented.
- Plaintext file bytes must not be sent to the backend.
- Do not claim Shelby/on-chain upload unless a real transaction/storage write is submitted and verified.
- Preserve the existing Stitch-derived visual direction and avoid broad redesign.

---

### Task 1: Fix Wallet Session Actions and Header Dead Buttons

**Files:**
- Modify: `src/components/app-shell/connected-wallet-badge.tsx`
- Create: `src/components/app-shell/header-actions.tsx`
- Modify: `src/components/app-shell/app-shell.tsx`
- Test: `tests/auth/app-shell.test.tsx`

**Interfaces:**
- Consumes: `ConnectedWalletBadge`
- Produces: `HeaderActions` client component rendering wallet, notifications, and settings.

- [x] **Step 1: Write failing tests**
  - Server-hydrated session logout must call `/api/auth/logout` even when the wallet adapter is disconnected.
  - Header `Notifications` and `Settings` buttons must open accessible dialogs.

- [x] **Step 2: Run focused test to verify RED**
  - Run: `pnpm vitest run tests/auth/app-shell.test.tsx`
  - Observed: failed for missing logout/session behavior and missing dialogs.

- [x] **Step 3: Implement minimal fix**
  - Revoke the web session before best-effort wallet adapter disconnect.
  - Move header buttons into `HeaderActions` and add concrete dialogs.

- [x] **Step 4: Run focused test to verify GREEN**
  - Run: `pnpm vitest run tests/auth/app-shell.test.tsx`

### Task 2: Make Upload Activity Reliable Across Pages

**Files:**
- Create: `src/client/uploads/local-upload-cache.ts`
- Modify: `src/features/upload/upload-panel.tsx`
- Modify: `src/features/uploads/upload-activity.tsx`
- Test: `tests/uploads/local-upload-cache.test.ts`
- Test: `tests/uploads/upload-panel.test.tsx`
- Test: `tests/dashboard/dashboard-content.test.tsx`

**Interfaces:**
- Produces: `rememberLocalUploadBatch(batch)`, `readLocalUploadBatches()`, `mergeUploadBatches(apiBatches, localBatches)`.
- Consumes: `UploadApiBatchResponse`.

- [x] **Step 1: Write failing tests**
  - Local cache deduplicates by batch ID and survives malformed storage values.
  - Upload panel stores the completed batch locally after queue success.
  - Dashboard activity merges API batches with local batches.

- [x] **Step 2: Run focused tests to verify RED**
  - Run: `pnpm vitest run tests/uploads/local-upload-cache.test.ts tests/uploads/upload-panel.test.tsx tests/dashboard/dashboard-content.test.tsx`

- [x] **Step 3: Implement minimal fix**
  - Add localStorage cache with safe parsing and max entry cap.
  - Save completed upload batches after `/complete`.
  - Merge cached and API batches in upload activity.

- [x] **Step 4: Run focused tests to verify GREEN**
  - Run: `pnpm vitest run tests/uploads/local-upload-cache.test.ts tests/uploads/upload-panel.test.tsx tests/dashboard/dashboard-content.test.tsx`

### Task 3: Wire Pack Search, Filter, and Sort

**Files:**
- Modify: `src/app/app/packs/page.tsx`
- Modify: `src/features/uploads/upload-activity.tsx`
- Test: `tests/packs/packs-page.test.tsx`

**Interfaces:**
- Produces: client-side search, status filter, and sort behavior inside `PacksUploadActivity`.

- [x] **Step 1: Write failing tests**
  - Search by non-matching text hides all rows and shows a no-match state.
  - `Verified` filter hides `waiting_for_pack` rows.
  - `Largest contribution` sort orders rows by bytes descending.

- [x] **Step 2: Run focused test to verify RED**
  - Run: `pnpm vitest run tests/packs/packs-page.test.tsx`

- [x] **Step 3: Implement minimal fix**
  - Move controls into the client component that owns batch state.
  - Apply filter and sort before rendering rows.

- [x] **Step 4: Run focused test to verify GREEN**
  - Run: `pnpm vitest run tests/packs/packs-page.test.tsx`

### Task 4: Expose Real Storage/Chain Readiness

**Files:**
- Create: `src/server/storage/storage-driver.ts`
- Create: `src/app/api/storage/status/route.ts`
- Modify: `src/features/upload/upload-panel.tsx`
- Test: `tests/storage/storage-status-route.test.ts`
- Test: `tests/uploads/upload-panel.test.tsx`

**Interfaces:**
- Produces: `getStorageDriverStatus()` returning driver, network, missing configuration, and mode.
- Consumes: `SHELBY_DRIVER`, `SHELBY_NETWORK`, `SHELBY_API_URL`, and `SHELBY_CREDENTIAL_FILE`.

- [x] **Step 1: Write failing tests**
  - Status route reports `ready: false` when Shelby writer configuration is incomplete.
  - Upload UI labels success as control-plane queued, not chain-written, when storage is not ready.

- [x] **Step 2: Run focused tests to verify RED**
  - Run: `pnpm vitest run tests/storage/storage-status-route.test.ts tests/uploads/upload-panel.test.tsx`

- [x] **Step 3: Implement minimal fix**
  - Add read-only storage status endpoint.
  - Display storage readiness and avoid claiming on-chain completion without transaction evidence.

- [x] **Step 4: Run focused tests to verify GREEN**
  - Run: `pnpm vitest run tests/storage/storage-status-route.test.ts tests/uploads/upload-panel.test.tsx`

### Task 5: Runtime Verification and Chain Evidence

**Files:**
- No production code unless verification identifies a new root cause.

**Interfaces:**
- Consumes: deployed Vercel app and connected Aptos wallet.
- Produces: exact verification notes: upload batch ID, whether a transaction prompt occurred, and Aptos testnet account transaction evidence.

- [x] **Step 1: Run static checks**
  - Run: `pnpm test`
  - Run: `pnpm lint`
  - Run: `pnpm typecheck`
  - Run: `pnpm build`
  - Run: `pnpm test:e2e`

- [ ] **Step 2: Deploy**
  - Push to GitHub private repo remote.
  - Deploy to Vercel production alias.

- [ ] **Step 3: Chrome test**
  - Connect wallet using the extension picker.
  - Upload a small generated test file.
  - Verify Dashboard and Packs show the uploaded batch.
  - Verify logout, notifications, settings, documentation navigation.

- [ ] **Step 4: Chain verification**
  - Query Aptos testnet account transactions before and after upload.
  - If there is no new transaction, report that the current product has working encrypted upload control-plane behavior but still lacks a safe real Shelby/on-chain writer.
