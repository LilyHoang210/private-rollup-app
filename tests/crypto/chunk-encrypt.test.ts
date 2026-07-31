import { describe, expect, it } from "vitest";
import {
  decryptChunkedPayload,
  encryptChunkedPayload,
  makeChunkNonce,
} from "../../src/client/crypto/chunk-encrypt";

describe("chunk encryption format", () => {
  const key = new Uint8Array(32).fill(7);
  const nonceBase = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const aad = new TextEncoder().encode("private-rollup:test-vector");

  it("uses an 8-byte nonce base plus a 32-bit chunk index", () => {
    expect([...makeChunkNonce(nonceBase, 0)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 0, 0]);
    expect([...makeChunkNonce(nonceBase, 258)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 1, 2]);
  });

  it("round-trips AES-GCM chunks and records format metadata", async () => {
    const plaintext = new TextEncoder().encode("hello encrypted storage rollup");

    const encrypted = await encryptChunkedPayload({
      plaintext,
      key,
      nonceBase,
      aad,
      chunkSize: 8,
    });

    expect(encrypted.magic).toBe("PRCF");
    expect(encrypted.version).toBe(1);
    expect(encrypted.chunkSize).toBe(8);
    expect(encrypted.chunks).toHaveLength(4);
    expect(new TextDecoder().decode(encrypted.chunks[0].ciphertext)).not.toContain("hello");
    await expect(decryptChunkedPayload(encrypted, key, aad)).resolves.toEqual(plaintext);
  });

  it("rejects tampered chunk ciphertext", async () => {
    const encrypted = await encryptChunkedPayload({
      plaintext: new TextEncoder().encode("tamper target"),
      key,
      nonceBase,
      aad,
      chunkSize: 6,
    });
    encrypted.chunks[0].ciphertext[0] ^= 1;

    await expect(decryptChunkedPayload(encrypted, key, aad)).rejects.toThrow();
  });
});
