# Threat Model

Status: draft for MVP implementation.

## Protected Data

- Plaintext file bytes.
- Plaintext filename, relative path, category, and user tags.
- Vault private key and recovery material.
- Raw wallet signatures and session tokens.
- Plaintext hashes.

## Current Boundaries

- Browser-side code owns plaintext and file encryption.
- The backend accepts only public vault material, ciphertext metadata, hashes, lifecycle state, and opaque encrypted metadata.
- The database is an operational index, not the recovery source of truth.
- Recovery is expected to work through receipts, encrypted manifests, recovery material, and storage range reads.

## Implemented Controls

- Database schema privacy test rejects sensitive column names.
- Metadata encryption helper protects sensitive metadata before persistence.
- Vault API schema is strict and rejects undeclared secret fields.
- Chunk decryption rejects tampered ciphertext through AES-GCM authentication.
- Upload API rejects plaintext payload fields and accepts encrypted metadata/control-plane state only.
- File DEKs are wrapped with HPKE/X25519 before upload batch creation.
- Payment Vault reservation hashes are verified on Shelbynet before durable upload metadata is accepted.
- Encrypted packs use private Vercel Blob staging before the worker writes a verified Shelby blob.
- Pack settlement calls the Payment Vault after Shelby verification; no local credit balance is fabricated.

## Open Risks

- Wallet authentication is an Aptos signed challenge, not a formal SIWA standard.
- Recovery kit generation is browser-local; losing the kit can make encrypted files unrecoverable.
- The service signer temporarily pays Shelby upload gas/storage before reimbursement from the Payment Vault.
- No independent cryptography audit has been performed.
