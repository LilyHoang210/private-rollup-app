import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ENVELOPE_VERSION = "v1";

export function encryptCustodialSigningMaterial(input: {
  privateKey: string;
  userId: string;
  address: string;
  masterKey?: string;
}) {
  const key = decodeMasterKey(input.masterKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad(input.userId, input.address));
  const ciphertext = Buffer.concat([
    cipher.update(input.privateKey, "utf8"),
    cipher.final(),
  ]);
  return [
    ENVELOPE_VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptCustodialSigningMaterial(input: {
  encrypted: string;
  userId: string;
  address: string;
  masterKey?: string;
}) {
  const [version, ivValue, tagValue, ciphertextValue, extra] =
    input.encrypted.split(".");
  if (
    version !== ENVELOPE_VERSION ||
    !ivValue ||
    !tagValue ||
    !ciphertextValue ||
    extra
  ) {
    throw new Error("Custodial signing material envelope is invalid");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    decodeMasterKey(input.masterKey),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAAD(aad(input.userId, input.address));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function decodeMasterKey(value = process.env.CUSTODIAL_WALLET_MASTER_KEY) {
  const decoded = value ? Buffer.from(value, "base64") : Buffer.alloc(0);
  if (decoded.byteLength !== 32) {
    throw new Error("CUSTODIAL_WALLET_MASTER_KEY must be 32 base64-encoded bytes");
  }
  return decoded;
}

function aad(userId: string, address: string) {
  return Buffer.from(`private-rollup:custodial-wallet:${userId}:${address}`, "utf8");
}
