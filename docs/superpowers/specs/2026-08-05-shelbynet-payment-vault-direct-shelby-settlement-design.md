# Shelbynet Payment Vault Direct Settlement Design

## Objective

Replace the current server-held service wallet model with a Shelbynet smart contract that receives upload payments, pays Shelby storage costs, releases the platform fee only after successful upload, and refunds the user fully when the upload fails before settlement.

This design follows the B-strict architecture: the webapp wallet is a deployed smart contract on Shelbynet, not an externally owned account controlled by the backend.

## Product stance

- The connected browser wallet remains the user's own wallet. It is not replaced.
- The webapp's payment wallet becomes a `Payment Vault` smart contract.
- Users pay when they submit an upload, not by maintaining opaque credits.
- The platform earns a fee only when the encrypted upload succeeds.
- If the upload fails before successful Shelby settlement, the user receives a full refund for the locked upload payment.
- The backend coordinates encryption metadata, pack building, and byte upload, but it does not custody user funds.

## Current Shelby integration facts

The Shelby SDK upload path is split across:

- encoding blob data and commitments,
- registering commitments on-chain,
- uploading blob data to Shelby RPC endpoints.

The current public SDK documentation describes:

- `useUploadBlobs` as handling encoding, on-chain commitment registration, and RPC upload;
- `useRegisterCommitments` as requiring a signer for on-chain registration;
- `useCommitBlobs` as uploading blob bytes to Shelby RPCs.

Therefore, direct contract settlement depends on Shelby exposing contract-callable Move entry points or APIs that let a third-party vault contract register/pay for blobs without an off-chain account owning those funds.

## Hard dependency

Direct payment from the vault contract to Shelby is only implementable if Shelbynet exposes a public Move interface for:

1. registering blob or pack commitments from a contract-controlled payment flow;
2. paying required Shelby storage/upload fees from contract-held funds;
3. producing on-chain events or state that our backend can link to the upload request;
4. making failures detectable so the vault can avoid releasing platform fees.

If these interfaces are not available, this design must stop at the protocol integration layer. It must not silently fall back to server-custodied user funds.

## Non-goals

- Do not change user wallet selection or supported wallet extensions.
- Do not store plaintext files on the backend.
- Do not introduce off-chain credits.
- Do not let the owner withdraw user deposits.
- Do not collect platform fees for failed uploads.
- Do not promise exact shared-pack fees before the pack is finalized unless Shelby exposes exact pricing at quote time.

## High-level flow

```text
User selects files
-> browser encrypts files locally
-> frontend requests upload quote
-> user reviews fee breakdown
-> user signs one upload-payment transaction
-> vault receives and locks funds for the upload request
-> vault registers/pays Shelby through Shelbynet contract interface
-> backend uploads encrypted bytes to Shelby RPC
-> backend reports success or failure
-> vault releases platform fee only on success
-> vault refunds unused buffer or full failed payment to user
```

## Upload payment quote

Before wallet signing, the UI must show a plain-English quote:

- encrypted size;
- retention duration;
- pack mode: shared pack or dedicated blob;
- estimated Shelby upload/registration fee;
- estimated storage fee;
- platform fee;
- safety buffer;
- total amount to lock;
- refund rule;
- pack close rule for shared packs.

For shared packs, the final Shelby cost can be unknown until the pack closes. The quote must be conservative:

```text
total_locked =
  estimated_shelby_upload_fee
+ estimated_storage_fee
+ platform_fee
+ safety_buffer
```

For settled shared packs:

```text
user_shelby_cost = actual_pack_shelby_cost * user_encrypted_bytes / total_pack_encrypted_bytes
platform_fee = fee_rule(user_shelby_cost, user_encrypted_bytes)
refund = total_locked - user_shelby_cost - platform_fee
```

If `refund` is positive, it becomes withdrawable by the user.

## Smart contract responsibilities

The `PaymentVault` contract owns the money flow.

It must:

- receive upload payments from user wallets;
- create upload reservations keyed by a request id;
- lock the total quoted amount;
- track user-available, reserved, settled, refunded, and failed amounts;
- pay Shelby through public Shelbynet interfaces;
- release platform fees to the configured owner address only after successful upload settlement;
- refund the full locked amount when an upload fails before settlement;
- allow users to withdraw refundable funds;
- emit events for frontend/backend indexing;
- enforce operator permissions for success/failure reporting;
- enforce owner-only configuration updates.

It must not:

- allow the backend/operator to withdraw arbitrary user funds;
- release platform fees before upload success;
- allow the owner to drain reserved or refundable user balances;
- depend on off-chain database balances as the source of truth.

## Contract state model

```text
VaultConfig
- owner: address
- operator: address
- platform_fee_bps: u64
- min_platform_fee_octas: u64
- max_safety_buffer_bps: u64
- refund_timeout_secs: u64
- paused: bool

UploadRequest
- request_id: vector<u8>
- user: address
- mode: shared_pack | dedicated_blob
- encrypted_size_bytes: u64
- retention_days: u64
- total_locked_octas: u64
- estimated_shelby_fee_octas: u64
- estimated_storage_fee_octas: u64
- platform_fee_octas: u64
- paid_to_shelby_octas: u64
- refunded_octas: u64
- owner_fee_released_octas: u64
- status: reserved | registering | uploading | settled | failed | refunded | expired
- created_at_secs: u64
- deadline_secs: u64
- blob_or_pack_name_hash: vector<u8>
- commitment_root: vector<u8>
```

The exact Move storage layout can be optimized during implementation, but these fields define the observable accounting model.

## Contract entry functions

### `upload_with_payment`

Called by the user wallet from the frontend.

Inputs:

- request id;
- encrypted size;
- retention;
- pack mode;
- commitment root for dedicated blobs, or pack commitment hash when available;
- blob/pack name hash;
- quoted Shelby fee;
- quoted storage fee;
- platform fee;
- safety buffer;
- deadline.

Effects:

- transfers the total payment from the user into the vault;
- creates a reserved upload request;
- calls Shelby registration/payment interface if available;
- emits `UploadReserved`.

### `mark_upload_success`

Called by the configured backend/operator after encrypted bytes are uploaded and Shelby confirms availability.

Effects:

- verifies the request is in a settleable state;
- records actual Shelby cost;
- releases platform fee to owner;
- unlocks unused buffer as refundable;
- marks request as settled;
- emits `UploadSettled`.

### `mark_upload_failed`

Called by the configured backend/operator when upload fails before successful settlement.

Effects:

- marks request as failed;
- makes the full refundable amount available to the user;
- releases no platform fee;
- emits `UploadFailed`.

### `refund_expired_upload`

Callable by the user after the deadline if the request is still unresolved.

Effects:

- marks request as expired;
- makes refundable funds available to the user according to the no-success-no-fee rule;
- emits `UploadExpiredRefundable`.

### `withdraw_refund`

Called by the user wallet.

Effects:

- transfers the user's refundable balance back to the connected wallet address;
- emits `RefundWithdrawn`.

### Admin functions

Owner-only:

- set owner;
- set operator;
- set platform fee;
- pause/unpause upload reservation.

Admin functions must not move user funds except for already-earned platform fees.

## Backend responsibilities

The backend remains necessary, but only as a coordinator and uploader.

It must:

- create upload quotes using the same deterministic fee model exposed in the UI;
- validate that a reservation exists on-chain before accepting encrypted upload bytes into a pack;
- upload encrypted blob/pack bytes to Shelby RPC;
- monitor Shelby availability/receipt status;
- call `mark_upload_success` only after success evidence is available;
- call `mark_upload_failed` when the upload cannot complete before deadline;
- index contract events for fast dashboard views.

It must not:

- store plaintext;
- store or spend user funds;
- invent credits;
- mark success without Shelby evidence;
- release platform fees off-chain.

## Frontend responsibilities

The frontend must explain the payment flow in user-facing English.

Upload wizard changes:

1. `Select files`
   - user selects files;
   - browser encrypts locally;
   - plaintext never leaves the browser.

2. `Review cost`
   - show Shelby fee estimate;
   - show storage estimate;
   - show platform fee;
   - show safety buffer;
   - show total amount locked;
   - explain refund rule.

3. `Pay and upload`
   - user signs `upload_with_payment`;
   - show transaction hash;
   - show reservation status.

4. `Track pack`
   - show shared pack pool progress;
   - show close rule by size or time;
   - show user's bytes in the pack.

5. `Settlement`
   - success: show Shelby blob/pack receipt, platform fee charged, refund available;
   - failure: show full refund available;
   - unresolved past deadline: show `Claim refund`.

Header wallet dialog changes:

- `Connected wallet`: wallet provider, address, network.
- `Payment vault`: vault contract address, user reserved amount, refundable amount, recent upload requests.
- No connected-wallet balance should be presented as the upload-paying balance.

## Pack pool behavior

Shared pack pools must show the conditions under which a pack uploads:

- current queued encrypted bytes;
- target upload threshold;
- max wait time;
- time remaining until forced close;
- user contribution in bytes;
- estimated user share of cost;
- status: collecting, closing, uploading, settling, settled, failed.

The pool view can remain aggregate-public, but user-specific financial data must require wallet session authentication.

## Failure and refund rules

The product promise is:

```text
No successful Shelby upload settlement => no platform fee.
```

Failure cases:

- wallet transaction rejected: no reservation, no charge;
- contract payment transaction fails: no reservation, no charge;
- Shelby registration fails before funds are paid: full refund;
- Shelby byte upload fails before success: full refund if no irreversible Shelby fee has been consumed;
- backend/operator stalls past deadline: user can call `refund_expired_upload`;
- success is reported: platform fee is released and unused buffer becomes refundable.

If Shelby consumes an irreversible protocol fee during registration but the later byte upload fails, true 100% refund is only possible if the platform maintains an insurance reserve. The UI and spec must not hide this. For the B-strict product promise, implementation should require either Shelby-level refundable registration or a platform-funded failure reserve.

## Security model

- The vault contract is the source of truth for payment state.
- Backend database state is cache/index only.
- Operator can report status but cannot withdraw user funds.
- Owner can receive earned fees but cannot claim fees for failed uploads.
- Users can self-recover refundable balances on-chain without the webapp.
- Request ids must be unique and collision-resistant.
- Contract events must include enough data for recovery and audit, but not private file labels or plaintext metadata.
- Encrypted file metadata must avoid leaking filenames where possible.

## User recovery if webapp stops operating

Users must be able to:

- inspect their upload requests on-chain;
- withdraw refundable funds directly from the contract;
- use local CLI recovery receipts to download encrypted blobs from Shelby;
- decrypt locally using their recovery material.

The documentation page must include:

- contract address;
- explorer link;
- CLI commands;
- where to find recovery kit;
- how to insert account/blob/receipt values;
- how refunds work without the webapp.

## Required UI copy direction

The UI must be explicit:

- "Your connected wallet pays into the Payment Vault."
- "The Payment Vault pays Shelby."
- "The platform fee is charged only after the upload succeeds."
- "If the upload fails before settlement, your locked amount is refundable."
- "Plaintext files are encrypted in your browser before upload."
- "Shared packs close when they reach the size threshold or max wait time."

All visible website content must remain English.

## Implementation phases

### Phase 1: Contract feasibility spike

- Identify Shelby Move modules and payment entry points on Shelbynet.
- Confirm whether third-party contracts can register commitments and pay Shelby directly.
- Confirm token types needed for Shelby payment: APT, ShelbyUSD, or both.
- Confirm whether failed registrations can be refunded or whether an insurance reserve is required.

This phase must complete before building production-facing payment logic.

### Phase 2: Payment vault contract

- Implement Move contract.
- Add unit tests for deposit, reserve, success settlement, failed refund, expired refund, owner fee release, and permission checks.
- Deploy to Shelbynet.
- Store contract address in environment configuration.

### Phase 3: Backend integration

- Replace server wallet balance APIs with contract-backed vault APIs.
- Add event indexing.
- Gate upload acceptance on on-chain reservation.
- Add success/failure settlement calls.

### Phase 4: Frontend integration

- Replace service-wallet UI with Payment Vault UI.
- Add upload quote review.
- Add one-click `Pay and upload`.
- Add refund/withdraw views.
- Add pack-pool settlement states.

### Phase 5: End-to-end verification

- Connect wallet on production preview.
- Upload a small encrypted file.
- Verify the vault reservation on-chain.
- Verify Shelby blob/pack exists through Shelby explorer or SDK list/download.
- Verify successful settlement releases platform fee.
- Verify failed path does not release platform fee and exposes refund.

## Acceptance criteria

- User wallet remains unchanged and only signs user-approved transactions.
- Webapp funds are held by a Shelbynet smart contract, not a server private key.
- Upload payment includes Shelby fee estimate, storage estimate, platform fee, and buffer.
- Platform fee is transferred to owner only after successful upload settlement.
- Failed uploads expose a full refund path.
- Users can withdraw refundable funds without relying on the webapp UI.
- Shared pack pools explain exactly when a pack will upload.
- All user-facing website text is English.
- The implementation does not silently reintroduce off-chain credits or custodial user balances.

## Open protocol risk

The largest risk is whether Shelby currently exposes public Move interfaces that allow a third-party smart contract to directly register/pay for storage. If not, the B-strict design is blocked until Shelby exposes that interface or the product accepts a separate operator-reimbursement design.
