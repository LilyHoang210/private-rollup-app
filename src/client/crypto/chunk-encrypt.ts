export interface EncryptedChunk {
  index: number;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}

export interface ChunkedPayload {
  magic: "PRCF";
  version: 1;
  algorithm: "AES-256-GCM";
  chunkSize: number;
  nonceBase: Uint8Array;
  chunks: EncryptedChunk[];
}

export function makeChunkNonce(nonceBase: Uint8Array, chunkIndex: number) {
  if (nonceBase.byteLength !== 8) {
    throw new Error("Nonce base must be 8 bytes");
  }

  if (!Number.isSafeInteger(chunkIndex) || chunkIndex < 0 || chunkIndex > 0xffffffff) {
    throw new Error("Chunk index must fit uint32");
  }

  const nonce = new Uint8Array(12);
  nonce.set(nonceBase, 0);
  new DataView(nonce.buffer).setUint32(8, chunkIndex, false);
  return nonce;
}

export async function encryptChunkedPayload(input: {
  plaintext: Uint8Array;
  key: Uint8Array;
  nonceBase: Uint8Array;
  aad: Uint8Array;
  chunkSize: number;
}): Promise<ChunkedPayload> {
  const cryptoKey = await importAesKey(input.key);

  if (!Number.isSafeInteger(input.chunkSize) || input.chunkSize <= 0) {
    throw new Error("Chunk size must be a positive integer");
  }

  const chunks: EncryptedChunk[] = [];
  for (let offset = 0, index = 0; offset < input.plaintext.byteLength; offset += input.chunkSize, index += 1) {
    const nonce = makeChunkNonce(input.nonceBase, index);
    const plaintextChunk = input.plaintext.slice(offset, offset + input.chunkSize);
    const ciphertext = new Uint8Array(
      await globalThis.crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: toArrayBuffer(nonce),
          additionalData: toArrayBuffer(input.aad),
          tagLength: 128,
        },
        cryptoKey,
        toArrayBuffer(plaintextChunk),
      ),
    );

    chunks.push({ index, nonce, ciphertext });
  }

  return {
    magic: "PRCF",
    version: 1,
    algorithm: "AES-256-GCM",
    chunkSize: input.chunkSize,
    nonceBase: input.nonceBase,
    chunks,
  };
}

export async function decryptChunkedPayload(
  payload: ChunkedPayload,
  key: Uint8Array,
  aad: Uint8Array,
) {
  if (payload.magic !== "PRCF" || payload.version !== 1) {
    throw new Error("Unsupported chunk format");
  }

  const cryptoKey = await importAesKey(key);
  const plaintextChunks: Uint8Array[] = [];

  for (const chunk of payload.chunks) {
    const expectedNonce = makeChunkNonce(payload.nonceBase, chunk.index);
    if (!equalBytes(expectedNonce, chunk.nonce)) {
      throw new Error("Chunk nonce mismatch");
    }

    plaintextChunks.push(
      new Uint8Array(
        await globalThis.crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: toArrayBuffer(chunk.nonce),
            additionalData: toArrayBuffer(aad),
            tagLength: 128,
          },
          cryptoKey,
          toArrayBuffer(chunk.ciphertext),
        ),
      ),
    );
  }

  return concatBytes(plaintextChunks);
}

async function importAesKey(key: Uint8Array) {
  if (key.byteLength !== 32) {
    throw new Error("AES-256-GCM key must be 32 bytes");
  }

  return globalThis.crypto.subtle.importKey("raw", toArrayBuffer(key), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function concatBytes(chunks: Uint8Array[]) {
  const output = new Uint8Array(
    chunks.reduce((total, chunk) => total + chunk.byteLength, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength !== right.byteLength) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}
