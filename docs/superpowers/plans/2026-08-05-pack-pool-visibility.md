# Pack Pool Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show users when Blob Packs will upload, including public aggregate pool progress, and why an upload is blocked by insufficient available APT.

**Architecture:** Add a server-side pack-pool summary derived from waiting upload batches and existing pack-selection constants. Expose aggregate-only data through public `/api/packs/pool`, consume it in the Packs page, and add selected-file eligibility/cost guidance in Upload. Wallet-scoped upload rows stay behind `/api/uploads`.

**Tech Stack:** Next.js App Router, React client components, Vitest/jsdom, existing in-memory and durable upload services.

## Global Constraints

- All website copy remains English.
- No plaintext file bytes, filenames, or private keys are sent to the server.
- Upload reserve and settlement remain denominated in APT/octas, not credits.
- Pack costs are allocated by ciphertext bytes.
- Public pack pool data exposes only aggregate bytes, count, retention, progress, and timing.
- Use TDD for behavior changes.

---

### Task 1: Server pack pool summary

**Files:**
- Modify: `src/server/packs/pack-selection.ts`
- Create: `src/server/packs/pool-summary.ts`
- Create: `src/app/api/packs/pool/route.ts`
- Test: `tests/packs/pack-pool-api.test.ts`

**Interfaces:**
- Produces constants `TARGET_SHARED_PACK_BYTES`, `MAX_SHARED_PACK_BYTES`, `MAX_WAIT_MS`.
- Produces `summarizePackPools({ now, batches })`.
- Produces public `GET /api/packs/pool` without requiring wallet session.

- [x] Write failing tests for cohort pool progress and public access.
- [x] Implement exported constants and summary function.
- [x] Implement API route.
- [x] Run focused pack-pool tests.

### Task 1B: Public aggregate pool privacy

**Files:**
- Modify: `src/server/uploads/service.ts`
- Modify: `src/server/uploads/durable-service.ts`
- Modify: `src/server/uploads/runtime-service.ts`
- Modify: `src/app/api/packs/pool/route.ts`
- Test: `tests/packs/pack-pool-api.test.ts`

**Interfaces:**
- Produces `listPackPoolBatchesRuntime(): Promise<UploadBatchRecord[]>`.
- Public API response returns aggregate `pools` only and omits `userBatchIds`, `oldestBatchId`, user ids, and file labels.

- [x] Write failing test proving `/api/packs/pool` works without a wallet session.
- [x] Write failing test proving the API response does not include batch ids, user ids, or labels.
- [x] Implement all-batch pool listing for in-memory and durable runtimes.
- [x] Run focused pack-pool API tests.

### Task 2: Client API and Packs page pool UI

**Files:**
- Modify: `src/client/api/uploads.ts`
- Modify: `src/features/uploads/upload-activity.tsx`
- Test: `tests/packs/packs-page.test.tsx`

**Interfaces:**
- Consumes `listPackPools()`.
- Shows all three pool cards with queued bytes, `8 MiB` target, `5 minutes` max wait, countdown, waiting batch count, and empty-pool state.

- [x] Write failing UI test for `90-day pool`, `897 B / 8.0 MiB`, and close trigger text.
- [x] Implement client fetcher and pool UI.
- [x] Run focused Packs page tests.

### Task 3: Upload eligibility and APT guidance

**Files:**
- Modify: `src/features/upload/upload-panel.tsx`
- Test: `tests/uploads/upload-panel.test.tsx`

**Interfaces:**
- Shows pack mode and reserve comparison before upload.
- Disables upload when `availableOctas < estimatedReserveOctas`.
- Shows missing APT and deposit/sync instruction.

- [x] Write failing UI test for missing APT message and disabled upload button.
- [x] Implement eligibility panel and actionable error copy.
- [x] Run focused Upload panel tests.

### Task 4: Verification and release

**Files:**
- Review all changed files.

- [x] Run `pnpm typecheck`.
- [x] Run `pnpm lint`.
- [x] Run `pnpm test`.
- [x] Run `pnpm build`.
- [ ] Commit, push, deploy production.
