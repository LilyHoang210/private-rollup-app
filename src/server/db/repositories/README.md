# Repository Boundary

Repositories live here only when a route handler, service, or worker needs a cohesive persistence operation. The schema is intentionally available before repository code so Task 3-5 can add methods test-first against real use cases instead of creating pass-through wrappers.

Repository methods must preserve these invariants:

- Scope user data by authenticated user ID or owner fingerprint.
- Accept only ciphertext, hashes, lifecycle state, byte ranges, retention cohort, and opaque encrypted metadata.
- Never accept plaintext filenames, paths, tags, private keys, recovery phrases, raw wallet signatures, file content, or session tokens.
- Use idempotency keys for upload initiation, completion, receipt creation, and job enqueueing.
