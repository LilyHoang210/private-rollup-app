# Private Rollup Data Model

The database is an operational index and cache. It is not the recovery source of truth. Recovery must remain possible from receipts, encrypted manifests, the recovery kit, and storage driver range reads.

## Privacy Boundary

Allowed cleartext fields:

| Class | Examples |
| --- | --- |
| Identity handles | user UUID, wallet address hash, owner key fingerprint |
| Lifecycle | upload status, pack status, job status, timestamps |
| Storage routing | driver, network, blob ID, blob name, staging object key |
| Verification | ciphertext bytes, ciphertext hash, receipt hash, service signature |
| Product rules | retention cohort, pack strategy, byte ranges |

Sensitive fields must be encrypted or excluded before persistence:

| Sensitive data | Database treatment |
| --- | --- |
| Original filename | encrypted metadata only |
| Relative path | encrypted metadata only |
| MIME-derived category | encrypted metadata only |
| User tags | encrypted metadata only |
| File bytes | never stored in DB |
| Plaintext hash | never stored in DB |
| Vault private key or recovery phrase | never sent to server |
| Raw wallet signature | verify then discard; store challenge/session hashes only |

## Tables

| Table | Purpose |
| --- | --- |
| `users` | Opaque user row keyed by wallet-address hash and owner fingerprint |
| `wallet_challenges` | One-time SIWA-style challenge data with TTL and nonce hash |
| `sessions` | HttpOnly session token hashes and expiration |
| `vault_public_keys` | Public vault encryption keys and fingerprints only |
| `upload_batches` | Batch lifecycle, idempotency key, retention cohort, aggregate ciphertext size |
| `upload_items` | Per-file ciphertext metadata, wrapped DEK, staging reference, status |
| `packs` | Shared or dedicated pack lifecycle, storage driver, blob identity, expiration |
| `pack_members` | User-owned byte range membership inside a pack |
| `receipts` | Signed receipt JSON, receipt hash, and owner scope |
| `jobs` | PostgreSQL worker queue with deduplication, lease, retry state |
| `outbox_events` | State-change events for dashboard/SSE delivery |

## Retention and Packing Rules

Retention cohorts are exactly `30`, `90`, and `365` days. Files smaller than `10 * 1024 * 1024` bytes use `shared_pack`; files at or above that threshold use `dedicated_blob`.

Shared packs may only mix ciphertext with the same retention cohort. A pack becomes available only after storage write and range-read verification have succeeded.
