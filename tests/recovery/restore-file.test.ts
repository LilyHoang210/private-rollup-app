import { describe, expect, it } from "vitest";
import { createRecoveryKit, importRecoveryKitKeyPair, wrapDekForVault } from "../../src/client/crypto/hpke";
import { encryptChunkedPayload } from "../../src/client/crypto/chunk-encrypt";
import { buildEncryptedPack, bytesToBase64 } from "../../src/client/uploads/encrypted-pack";
import { restoreFileFromReceipt } from "../../src/client/recovery/restore-file";

describe("offline-compatible file restore", () => {
  it("downloads, verifies, unwraps, and decrypts a file from a receipt", async () => {
    const kit = await createRecoveryKit();
    const keyPair = await importRecoveryKitKeyPair(kit);
    const plaintext = new TextEncoder().encode("restored secret content");
    const dek = new Uint8Array(32).fill(31);
    const nonceBase = new Uint8Array(8).fill(7);
    const aad = new TextEncoder().encode("private-rollup:upload:file-1");
    const encrypted = await encryptChunkedPayload({
      plaintext,
      key: dek,
      nonceBase,
      aad,
      chunkSize: 8,
    });
    const ciphertext = concat(encrypted.chunks.map((chunk) => chunk.ciphertext));
    const itemHash = await sha256Hex(ciphertext);
    const wrapped = await wrapDekForVault({
      dek,
      recipientPublicKey: keyPair.publicKey,
      aad,
    });
    const manifest = bytesToBase64(
      new TextEncoder().encode(
        JSON.stringify({
          magic: "PRCF",
          version: 1,
          algorithm: "AES-256-GCM",
          chunkSize: 8,
          chunkCount: encrypted.chunks.length,
          nonceBase: bytesToBase64(nonceBase),
        }),
      ),
    );
    const wrappedDek = bytesToBase64(
      new TextEncoder().encode(
        JSON.stringify({
          suite: wrapped.suite,
          enc: bytesToBase64(wrapped.enc),
          ciphertext: bytesToBase64(wrapped.ciphertext),
        }),
      ),
    );
    const pack = await buildEncryptedPack([
      {
        localId: "file-1",
        ciphertext,
        ciphertextSha256: itemHash,
        encryptedManifest: manifest,
        wrappedDek,
        aad: bytesToBase64(aad),
      },
    ]);
    const receipt = {
      format: "private-rollup-receipt" as const,
      formatVersion: 1 as const,
      batchId: "batch-1",
      retentionDays: 90 as const,
      storage: {
        driver: "shelby" as const,
        network: "shelbynet" as const,
        verified: true as const,
        ownerAddress: "0xservice",
        blobId: "42",
        blobName: "private-rollup/batch-1.prp",
        blobSizeBytes: pack.bytes.byteLength,
        ciphertextSha256: pack.sha256,
        expiresAt: "2027-01-01T00:00:00.000Z",
        downloadUrl: "https://example.test/batch-1.prp",
      },
      items: [
        {
          id: "item-1",
          localId: "file-1",
          label: "My restored file",
          category: "document" as const,
          ciphertextSizeBytes: ciphertext.byteLength,
          ciphertextSha256: itemHash,
          encryptedManifest: manifest,
          wrappedDek,
        },
      ],
    };

    const restored = await restoreFileFromReceipt({
      recoveryKit: kit,
      receipt,
      fileId: "item-1",
      fetcher: async () => new Response(pack.bytes),
    });

    expect(restored.bytes).toEqual(plaintext);
    expect(restored.suggestedFileName).toBe("My-restored-file.restored");
  });

  it("restores only the receipt byte range from a shared Shelby blob", async () => {
    const fixture = await createEncryptedFixture("shared range secret");
    const prefix = new Uint8Array([9, 8, 7, 6]);
    const suffix = new Uint8Array([5, 4, 3]);
    const sharedBlob = concat([prefix, fixture.pack.bytes, suffix]);
    const memberHash = await sha256Hex(fixture.pack.bytes);
    const requestedRanges: string[] = [];
    const receipt = {
      ...fixture.receipt,
      storage: {
        ...fixture.receipt.storage,
        blobSizeBytes: sharedBlob.byteLength,
        ciphertextSha256: await sha256Hex(sharedBlob),
        packRange: {
          byteStart: prefix.byteLength,
          byteLength: fixture.pack.bytes.byteLength,
          ciphertextSha256: memberHash,
        },
      },
    };

    const restored = await restoreFileFromReceipt({
      recoveryKit: fixture.kit,
      receipt,
      fileId: "item-1",
      fetcher: async (_url, init) => {
        requestedRanges.push(new Headers(init?.headers).get("range") ?? "");
        return new Response(fixture.pack.bytes, { status: 206 });
      },
    });

    expect(new TextDecoder().decode(restored.bytes)).toBe("shared range secret");
    expect(requestedRanges).toEqual([
      `bytes=${prefix.byteLength}-${prefix.byteLength + fixture.pack.bytes.byteLength - 1}`,
    ]);
  });
});

async function createEncryptedFixture(secret: string) {
  const kit = await createRecoveryKit();
  const keyPair = await importRecoveryKitKeyPair(kit);
  const plaintext = new TextEncoder().encode(secret);
  const dek = new Uint8Array(32).fill(21);
  const nonceBase = new Uint8Array(8).fill(6);
  const aad = new TextEncoder().encode("private-rollup:upload:file-1");
  const encrypted = await encryptChunkedPayload({
    plaintext,
    key: dek,
    nonceBase,
    aad,
    chunkSize: 8,
  });
  const ciphertext = concat(encrypted.chunks.map((chunk) => chunk.ciphertext));
  const itemHash = await sha256Hex(ciphertext);
  const wrapped = await wrapDekForVault({
    dek,
    recipientPublicKey: keyPair.publicKey,
    aad,
  });
  const manifest = bytesToBase64(
    new TextEncoder().encode(
      JSON.stringify({
        magic: "PRCF",
        version: 1,
        algorithm: "AES-256-GCM",
        chunkSize: 8,
        chunkCount: encrypted.chunks.length,
        nonceBase: bytesToBase64(nonceBase),
      }),
    ),
  );
  const wrappedDek = bytesToBase64(
    new TextEncoder().encode(
      JSON.stringify({
        suite: wrapped.suite,
        enc: bytesToBase64(wrapped.enc),
        ciphertext: bytesToBase64(wrapped.ciphertext),
      }),
    ),
  );
  const pack = await buildEncryptedPack([
    {
      localId: "file-1",
      ciphertext,
      ciphertextSha256: itemHash,
      encryptedManifest: manifest,
      wrappedDek,
      aad: bytesToBase64(aad),
    },
  ]);
  return {
    kit,
    pack,
    receipt: {
      format: "private-rollup-receipt" as const,
      formatVersion: 1 as const,
      batchId: "batch-shared",
      retentionDays: 90 as const,
      storage: {
        driver: "shelby" as const,
        network: "shelbynet" as const,
        verified: true as const,
        ownerAddress: "0xservice",
        blobId: "43",
        blobName: "private-rollup/shared.prp",
        blobSizeBytes: pack.bytes.byteLength,
        ciphertextSha256: pack.sha256,
        expiresAt: "2027-01-01T00:00:00.000Z",
        downloadUrl: "https://example.test/shared.prp",
      },
      items: [
        {
          id: "item-1",
          localId: "file-1",
          label: "Shared restored file",
          category: "document" as const,
          ciphertextSizeBytes: ciphertext.byteLength,
          ciphertextSha256: itemHash,
          encryptedManifest: manifest,
          wrappedDek,
        },
      ],
    },
  };
}

function concat(parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

async function sha256Hex(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
