# Encryption Format

Status: implemented MVP crypto envelope for Task 4.

The current implementation locks the local chunk encryption envelope, HPKE/X25519 DEK wrapping, and test vector behavior. It is still pre-audit MVP cryptography and should not be represented as production-secure until independent review and cross-runtime vectors are complete.

## Chunk Payload

| Field | Value |
| --- | --- |
| Magic | `PRCF` |
| Version | `1` |
| Cipher | `AES-256-GCM` |
| Default chunk size | `1 MiB` |
| Authentication tag | 128-bit GCM tag appended by Web Crypto |
| Nonce | 8-byte random nonce base plus 32-bit big-endian chunk index |
| AAD | Caller-provided format/context bytes |

Each chunk is encrypted independently. The decryptor recomputes the expected nonce from `nonceBase` and `chunk.index` and rejects nonce mismatch before decryption.

## Implemented Tests

- Nonce construction for chunk indexes `0` and `258`.
- AES-GCM roundtrip across multiple chunks.
- Ciphertext tamper rejection.
- HPKE DEK wrap/unwrap with `DHKEM(X25519, HKDF-SHA256)`, `HKDF-SHA256`, and `AES-256-GCM`.
- HPKE AAD tamper rejection.
- Vault public key registration rejects private or recovery material.

## DEK Wrapping

| Field | Value |
| --- | --- |
| Suite | `DHKEM_X25519_HKDF_SHA256_HKDF_SHA256_AES_256_GCM` |
| KEM | `DHKEM(X25519, HKDF-SHA256)` |
| KDF | `HKDF-SHA256` |
| AEAD | `AES-256-GCM` |
| HPKE info | `private-rollup:v1:file-dek` |
| AAD | Caller-provided receipt/upload context bytes |

Each file DEK is 32 bytes. The wrapper stores the HPKE encapsulated key (`enc`) and DEK ciphertext. The public vault key can be serialized; the wrapper module does not expose serialized private key material.

## Upload Control-Plane Slice

The upload page now encrypts selected file bytes locally, wraps each DEK through HPKE, calculates ciphertext checksums, and sends only encrypted metadata/control-plane records to `/api/uploads`.

The current staging reference is `local-browser://...` because object staging and pack writing are not implemented yet.

## Pending Before Production Claims

- Browser-generated recovery kit flow.
- Cross-runtime test vectors shared by browser, worker, and CLI.
- Security review for nonce uniqueness, DEK lifecycle, HPKE info/AAD, and recovery derivation.
- Durable object staging and pack writer integration.
