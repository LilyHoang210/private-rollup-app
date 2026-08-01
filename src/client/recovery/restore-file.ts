import {
  importRecoveryKitKeyPair,
  unwrapDekForVault,
  type RecoveryKit,
  type WrappedDek,
} from "@/client/crypto/hpke";
import {
  decryptChunkedPayload,
  makeChunkNonce,
  type EncryptedChunk,
} from "@/client/crypto/chunk-encrypt";
import {
  base64ToBytes,
  parseEncryptedPack,
} from "@/client/uploads/encrypted-pack";
import type { PrivateRollupReceipt } from "@/domain/private-rollup-receipt";

export async function restoreFileFromReceipt(input: {
  recoveryKit: RecoveryKit;
  receipt: PrivateRollupReceipt;
  fileId: string;
  fetcher?: typeof fetch;
}) {
  validateReceipt(input.receipt);
  const receiptItem = input.receipt.items.find(
    (item) => item.id === input.fileId || item.localId === input.fileId,
  );
  if (!receiptItem) throw new Error("File ID was not found in the receipt");

  const response = await (input.fetcher ?? fetch)(input.receipt.storage.downloadUrl);
  if (!response.ok) throw new Error(`Shelby download failed: ${response.status}`);
  const packBytes = new Uint8Array(await response.arrayBuffer());
  if ((await sha256Hex(packBytes)) !== input.receipt.storage.ciphertextSha256) {
    throw new Error("Downloaded pack checksum does not match the receipt");
  }

  const pack = parseEncryptedPack(packBytes);
  const packItem = pack.items.find((item) => item.localId === receiptItem.localId);
  if (!packItem) throw new Error("Encrypted file was not found inside the pack");
  const ciphertext = base64ToBytes(packItem.ciphertext);
  if (
    ciphertext.byteLength !== receiptItem.ciphertextSizeBytes ||
    (await sha256Hex(ciphertext)) !== receiptItem.ciphertextSha256
  ) {
    throw new Error("Encrypted file checksum does not match the receipt");
  }

  const manifest = parseBase64Json<{
    magic: "PRCF";
    version: 1;
    algorithm: "AES-256-GCM";
    chunkSize: number;
    chunkCount: number;
    nonceBase: string;
  }>(packItem.encryptedManifest);
  const wrapped = parseBase64Json<{
    suite: WrappedDek["suite"];
    enc: string;
    ciphertext: string;
  }>(packItem.wrappedDek);
  const aad = base64ToBytes(packItem.aad);
  const keyPair = await importRecoveryKitKeyPair(input.recoveryKit);
  const dek = await unwrapDekForVault({
    wrapped: {
      suite: wrapped.suite,
      enc: base64ToBytes(wrapped.enc),
      ciphertext: base64ToBytes(wrapped.ciphertext),
    },
    recipientPrivateKey: keyPair.privateKey,
    aad,
  });
  const nonceBase = base64ToBytes(manifest.nonceBase);
  const chunks = splitCiphertext(
    ciphertext,
    manifest.chunkSize,
    manifest.chunkCount,
    nonceBase,
  );
  const bytes = await decryptChunkedPayload(
    {
      magic: manifest.magic,
      version: manifest.version,
      algorithm: manifest.algorithm,
      chunkSize: manifest.chunkSize,
      nonceBase,
      chunks,
    },
    dek,
    aad,
  );

  return {
    bytes,
    suggestedFileName: `${safeFileName(receiptItem.label)}.restored`,
    mimeType: receiptItem.mimeType || "application/octet-stream",
  };
}

function validateReceipt(receipt: PrivateRollupReceipt) {
  if (
    receipt.format !== "private-rollup-receipt" ||
    receipt.formatVersion !== 1 ||
    receipt.storage.driver !== "shelby" ||
    !receipt.storage.verified
  ) {
    throw new Error("Unsupported or unverified receipt");
  }
}

function splitCiphertext(
  ciphertext: Uint8Array,
  plaintextChunkSize: number,
  chunkCount: number,
  nonceBase: Uint8Array,
): EncryptedChunk[] {
  if (!Number.isSafeInteger(chunkCount) || chunkCount <= 0) {
    throw new Error("Encrypted manifest has an invalid chunk count");
  }
  const fullCiphertextChunkSize = plaintextChunkSize + 16;
  const chunks: EncryptedChunk[] = [];
  let offset = 0;
  for (let index = 0; index < chunkCount; index += 1) {
    const remaining = ciphertext.byteLength - offset;
    const length = index === chunkCount - 1 ? remaining : fullCiphertextChunkSize;
    if (length <= 16 || length > remaining) {
      throw new Error("Encrypted pack chunk boundaries are invalid");
    }
    chunks.push({
      index,
      nonce: makeChunkNonce(nonceBase, index),
      ciphertext: ciphertext.slice(offset, offset + length),
    });
    offset += length;
  }
  if (offset !== ciphertext.byteLength) {
    throw new Error("Encrypted pack contains trailing bytes");
  }
  return chunks;
}

function parseBase64Json<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(base64ToBytes(value))) as T;
}

async function sha256Hex(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeFileName(label: string) {
  return label.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "restored-file";
}
