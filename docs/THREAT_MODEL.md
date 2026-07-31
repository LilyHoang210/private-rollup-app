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

## Open Risks

- Demo wallet verification is not Aptos SIWA.
- Recovery kit generation is not implemented.
- Durable upload staging and pack writing are not implemented.
- The current upload UI uses a local demo vault key for HPKE wrapping; persisted user vault key selection is not wired into upload yet.
- No independent cryptography audit has been performed.
