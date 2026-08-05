# Pack Pool Visibility Design

**Goal:** Make Blob Packs understandable before and after upload by showing the exact conditions that cause a pack to be uploaded to Shelby.

**Design:**
- Upload shows pack eligibility for the selected files: shared pack versus dedicated blob, retention cohort, estimated reserve, available APT, and missing APT when the upload cannot be queued.
- Blob Packs shows waiting pool progress per retention cohort: queued bytes, batch count, byte threshold progress, oldest wait timer, and the trigger that will close the pack.
- The server exposes a wallet-scoped `GET /api/packs/pool` endpoint so frontend copy is based on real queue data, not hardcoded demo state.

**Rules exposed to users:**
- Files smaller than `10 MiB` join a shared pack.
- Files `10 MiB` or larger use a dedicated blob.
- Shared packs only combine uploads with the same retention cohort: `30`, `90`, or `365` days.
- A shared pack is uploaded when the cohort reaches `8 MiB` or the oldest waiting batch reaches `5 minutes`.
- A shared pack is capped at `50 MiB`.
- Final pack cost is allocated by ciphertext bytes.

**Error handling:**
- When available APT is below the estimated reserve, disable upload and explain the exact reserve, available amount, and missing amount.
- Server-side `APT_INSUFFICIENT` errors should also surface as an actionable deposit-and-sync instruction.
