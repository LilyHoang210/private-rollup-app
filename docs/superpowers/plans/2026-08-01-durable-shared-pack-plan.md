# Durable Shared Pack Implementation Plan

**Goal:** Turn Private Rollup into a durable multi-user service that stages browser-encrypted bytes, closes shared packs, writes verified blobs to Shelby, and settles prepaid credits by each member's encrypted byte contribution.

**Architecture:** The browser encrypts files and uploads only ciphertext directly to a private Vercel Blob store. Postgres is the source of truth for users, credit reservations, upload queue state, packs, memberships, receipts, and worker leases. A protected Vercel Cron route leases eligible uploads by retention cohort, concatenates their encrypted pack bytes, writes one blob through the Shelby service wallet, verifies the on-chain object, allocates cost by bytes, persists byte-range receipts, and deletes temporary staging objects only after durable completion.

**Constraints:**

- All user-facing copy is English.
- Plaintext bytes never leave the browser.
- Private staging URLs and credentials never appear in public receipts or client logs.
- Credit math uses integer microcredits and exact byte allocation.
- Worker operations are idempotent and safe to retry.
- Recovery remains possible without the web app using a recovery kit, receipt, and standalone CLI.

## Task 1: Infrastructure and configuration

- [x] Create a private Vercel Blob store and connect it to the project.
- [ ] Provision Neon Postgres on the free plan and connect all environments.
- [ ] Add `CRON_SECRET`, migrate the database, and validate connectivity.

## Task 2: Durable database and credit ledger

- [ ] Add database client and migrations for staging records and credit accounts/ledger.
- [ ] Add transactional repositories for upload creation, reservation, listing, failure, and settlement.
- [ ] Preserve an isolated in-memory adapter only for unit tests.
- [ ] Prove idempotency, exact byte allocation, and cross-instance persistence with tests.

## Task 3: Direct ciphertext staging

- [ ] Add authenticated Vercel Blob client-upload token route.
- [ ] Upload encrypted pack bytes directly from the browser to private staging.
- [ ] Persist only the staging object key, checksum, byte count, and encrypted metadata.
- [ ] Show queued/closing/available states and explain that shared packs close asynchronously.

## Task 4: Shared pack worker and Shelby settlement

- [ ] Add a protected cron route with a database lease.
- [ ] Select eligible uploads by retention cohort and close by byte threshold or maximum wait.
- [ ] Concatenate member encrypted packs and persist exact byte ranges.
- [ ] Write and verify the shared blob on Shelby using the service wallet.
- [ ] Settle the total pack cost by encrypted bytes and generate one portable receipt per member.
- [ ] Delete private staging objects only after pack, receipts, and ledger entries commit.

## Task 5: Recovery and product UI

- [ ] Extend the receipt schema and CLI to restore a member byte range from a shared blob.
- [ ] Replace local-only activity with durable Dashboard and Packs data.
- [ ] Add receipt download when verification completes and actionable retry/payment states.
- [ ] Keep dedicated upload behavior available for files above the shared-pack threshold.

## Task 6: Verification and release

- [ ] Run focused tests after each task, then full tests, lint, typecheck, CLI build, and production build.
- [ ] Review the diff for secrets, generated files, stale copy, and unintended UI changes.
- [ ] Apply production migrations, deploy, and inspect Vercel function/cron logs.
- [ ] Use Chrome as a real wallet-authenticated user to upload, wait for pack closure, download a receipt, restore the file with the CLI, and verify the Shelby object on-chain.
