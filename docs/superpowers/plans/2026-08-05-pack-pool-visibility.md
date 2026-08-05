# Pack Pool Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show users when Blob Packs will upload and why an upload is blocked by insufficient available APT.

**Architecture:** Add a server-side pack-pool summary derived from waiting upload batches and existing pack-selection constants. Expose it through `/api/packs/pool`, consume it in the Packs page, and add selected-file eligibility/cost guidance in Upload.

**Tech Stack:** Next.js App Router, React client components, Vitest/jsdom, existing in-memory and durable upload services.

## Global Constraints

- All website copy remains English.
- No plaintext file bytes, filenames, or private keys are sent to the server.
- Upload reserve and settlement remain denominated in APT/octas, not credits.
- Pack costs are allocated by ciphertext bytes.
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
- Produces `GET /api/packs/pool`.

- [ ] Write failing tests for cohort pool progress and auth requirement.
- [ ] Implement exported constants and summary function.
- [ ] Implement API route.
- [ ] Run focused pack-pool tests.

### Task 2: Client API and Packs page pool UI

**Files:**
- Modify: `src/client/api/uploads.ts`
- Modify: `src/features/uploads/upload-activity.tsx`
- Test: `tests/packs/packs-page.test.tsx`

**Interfaces:**
- Consumes `listPackPools()`.
- Shows pool cards with queued bytes, `8 MiB` target, `5 minutes` max wait, countdown, and waiting batch count.

- [ ] Write failing UI test for `90-day pool`, `897 B / 8.0 MiB`, and close trigger text.
- [ ] Implement client fetcher and pool UI.
- [ ] Run focused Packs page tests.

### Task 3: Upload eligibility and APT guidance

**Files:**
- Modify: `src/features/upload/upload-panel.tsx`
- Test: `tests/uploads/upload-panel.test.tsx`

**Interfaces:**
- Shows pack mode and reserve comparison before upload.
- Disables upload when `availableOctas < estimatedReserveOctas`.
- Shows missing APT and deposit/sync instruction.

- [ ] Write failing UI test for missing APT message and disabled upload button.
- [ ] Implement eligibility panel and actionable error copy.
- [ ] Run focused Upload panel tests.

### Task 4: Verification and release

**Files:**
- Review all changed files.

- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
- [ ] Commit, push, deploy production.
