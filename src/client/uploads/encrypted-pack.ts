export interface EncryptedPackItemInput {
  localId: string;
  ciphertext: Uint8Array;
  ciphertextSha256: string;
  encryptedManifest: string;
  wrappedDek: string;
  aad: string;
}

export interface EncryptedPackDocument {
  magic: "PRPK";
  version: 1;
  items: Array<{
    localId: string;
    ciphertext: string;
    ciphertextSha256: string;
    encryptedManifest: string;
    wrappedDek: string;
    aad: string;
  }>;
}

export async function buildEncryptedPack(items: EncryptedPackItemInput[]) {
  if (items.length === 0) {
    throw new Error("Encrypted pack requires at least one file");
  }

  const document: EncryptedPackDocument = {
    magic: "PRPK",
    version: 1,
    items: items.map((item) => ({
      localId: item.localId,
      ciphertext: bytesToBase64(item.ciphertext),
      ciphertextSha256: item.ciphertextSha256,
      encryptedManifest: item.encryptedManifest,
      wrappedDek: item.wrappedDek,
      aad: item.aad,
    })),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(document));
  return { bytes, sha256: await sha256Hex(bytes), document };
}

export function parseEncryptedPack(bytes: Uint8Array): EncryptedPackDocument {
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as EncryptedPackDocument;
  if (parsed.magic !== "PRPK" || parsed.version !== 1 || !Array.isArray(parsed.items)) {
    throw new Error("Unsupported encrypted pack format");
  }
  return parsed;
}

export function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return globalThis.btoa(binary);
}

export function base64ToBytes(value: string) {
  const binary = globalThis.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sha256Hex(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
