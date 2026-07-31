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
