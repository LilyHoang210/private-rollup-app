import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "prm1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

type SensitiveMetadata = Record<string, unknown>;

function assertMetadataKey(key: Buffer) {
  if (key.byteLength !== 32) {
    throw new Error("Invalid metadata key length; expected 32 bytes");
  }
}

function encodeBase64Url(buffer: Buffer) {
  return buffer.toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

export function encryptSensitiveMetadata(
  metadata: SensitiveMetadata,
  key: Buffer,
): string {
  assertMetadataKey(key);

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  cipher.setAAD(Buffer.from(VERSION));

  const plaintext = Buffer.from(JSON.stringify(metadata), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, encodeBase64Url(iv), encodeBase64Url(tag), encodeBase64Url(ciphertext)].join(
    ".",
  );
}

export function decryptSensitiveMetadata(
  encrypted: string,
  key: Buffer,
): SensitiveMetadata {
  assertMetadataKey(key);

  const [version, encodedIv, encodedTag, encodedCiphertext] = encrypted.split(".");
  if (version !== VERSION || !encodedIv || !encodedTag || !encodedCiphertext) {
    throw new Error("Invalid encrypted metadata format");
  }

  const decipher = createDecipheriv(ALGORITHM, key, decodeBase64Url(encodedIv), {
    authTagLength: AUTH_TAG_BYTES,
  });
  decipher.setAAD(Buffer.from(VERSION));
  decipher.setAuthTag(decodeBase64Url(encodedTag));

  const plaintext = Buffer.concat([
    decipher.update(decodeBase64Url(encodedCiphertext)),
    decipher.final(),
  ]);

  return JSON.parse(plaintext.toString("utf8")) as SensitiveMetadata;
}
