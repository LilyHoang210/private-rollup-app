import { Aes256Gcm, CipherSuite, HkdfSha256 } from "@hpke/core";
import { DhkemX25519HkdfSha256 } from "@hpke/dhkem-x25519";

export const HPKE_DEK_WRAP_SUITE =
  "DHKEM_X25519_HKDF_SHA256_HKDF_SHA256_AES_256_GCM" as const;
export const HPKE_DEK_WRAP_INFO = "private-rollup:v1:file-dek";

export interface VaultKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyBytes: Uint8Array;
}

export interface WrappedDek {
  suite: typeof HPKE_DEK_WRAP_SUITE;
  enc: Uint8Array;
  ciphertext: Uint8Array;
}

export interface RecoveryKit {
  format: "private-rollup-recovery-kit";
  formatVersion: 1;
  algorithm: "DHKEM_X25519_HKDF_SHA256";
  suite: typeof HPKE_DEK_WRAP_SUITE;
  publicKey: string;
  privateKey: string;
  ownerFingerprint: string;
  createdAt: string;
}

const hpkeInfo = new TextEncoder().encode(HPKE_DEK_WRAP_INFO);

function createDekWrapSuite() {
  return new CipherSuite({
    kem: new DhkemX25519HkdfSha256(),
    kdf: new HkdfSha256(),
    aead: new Aes256Gcm(),
  });
}

export async function generateVaultKeyPair(): Promise<VaultKeyPair> {
  const suite = createDekWrapSuite();
  const keyPair = await suite.kem.generateKeyPair();
  const publicKeyBytes = new Uint8Array(
    await suite.kem.serializePublicKey(keyPair.publicKey),
  );

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    publicKeyBytes,
  };
}

export async function createRecoveryKit(): Promise<RecoveryKit> {
  const suite = createDekWrapSuite();
  const keyPair = await suite.kem.generateKeyPair();
  const publicKeyBytes = new Uint8Array(
    await suite.kem.serializePublicKey(keyPair.publicKey),
  );
  const privateKeyBytes = new Uint8Array(
    await suite.kem.serializePrivateKey(keyPair.privateKey),
  );
  const ownerFingerprint = await sha256Hex(
    new TextEncoder().encode(
      `DHKEM_X25519_HKDF_SHA256:${bytesToBase64(publicKeyBytes)}`,
    ),
  );

  return {
    format: "private-rollup-recovery-kit",
    formatVersion: 1,
    algorithm: "DHKEM_X25519_HKDF_SHA256",
    suite: HPKE_DEK_WRAP_SUITE,
    publicKey: bytesToBase64(publicKeyBytes),
    privateKey: bytesToBase64(privateKeyBytes),
    ownerFingerprint,
    createdAt: new Date().toISOString(),
  };
}

export async function importRecoveryKitKeyPair(kit: RecoveryKit) {
  if (
    kit.format !== "private-rollup-recovery-kit" ||
    kit.formatVersion !== 1 ||
    kit.algorithm !== "DHKEM_X25519_HKDF_SHA256" ||
    kit.suite !== HPKE_DEK_WRAP_SUITE
  ) {
    throw new Error("Unsupported recovery kit format");
  }

  const suite = createDekWrapSuite();
  const publicKey = await suite.kem.deserializePublicKey(
    base64ToBytes(kit.publicKey),
  );
  const privateKey = await suite.kem.deserializePrivateKey(
    base64ToBytes(kit.privateKey),
  );

  return { publicKey, privateKey, publicKeyBytes: base64ToBytes(kit.publicKey) };
}

export async function importVaultPublicKey(publicKeyBytes: Uint8Array): Promise<CryptoKey> {
  const suite = createDekWrapSuite();
  return suite.kem.deserializePublicKey(publicKeyBytes);
}

export async function wrapDekForVault(input: {
  dek: Uint8Array;
  recipientPublicKey: CryptoKey;
  aad: Uint8Array;
}): Promise<WrappedDek> {
  assertDek(input.dek);
  const suite = createDekWrapSuite();
  const senderContext = await suite.createSenderContext({
    recipientPublicKey: input.recipientPublicKey,
    info: hpkeInfo,
  });

  const ciphertext = new Uint8Array(
    await senderContext.seal(input.dek, input.aad),
  );

  return {
    suite: HPKE_DEK_WRAP_SUITE,
    enc: new Uint8Array(senderContext.enc),
    ciphertext,
  };
}

export async function unwrapDekForVault(input: {
  wrapped: WrappedDek;
  recipientPrivateKey: CryptoKey;
  aad: Uint8Array;
}): Promise<Uint8Array> {
  if (input.wrapped.suite !== HPKE_DEK_WRAP_SUITE) {
    throw new Error("Unsupported HPKE DEK wrap suite");
  }

  const suite = createDekWrapSuite();
  const recipientContext = await suite.createRecipientContext({
    recipientKey: input.recipientPrivateKey,
    enc: input.wrapped.enc,
    info: hpkeInfo,
  });

  const dek = new Uint8Array(
    await recipientContext.open(input.wrapped.ciphertext, input.aad),
  );
  assertDek(dek);
  return dek;
}

function assertDek(dek: Uint8Array) {
  if (dek.byteLength !== 32) {
    throw new Error("File DEK must be 32 bytes");
  }
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return globalThis.btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = globalThis.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sha256Hex(bytes: Uint8Array) {
  const input = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(input).set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
