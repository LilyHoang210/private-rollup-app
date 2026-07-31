import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decryptSensitiveMetadata,
  encryptSensitiveMetadata,
} from "../../src/server/security/metadata-crypto";

describe("sensitive metadata encryption", () => {
  const key = randomBytes(32);
  const metadata = {
    name: "passport.pdf",
    relativePath: "identity/passport.pdf",
    category: "document",
    tags: ["identity", "family"],
  };

  it("round-trips metadata without exposing sensitive values in ciphertext", () => {
    const encrypted = encryptSensitiveMetadata(metadata, key);

    expect(encrypted).not.toContain(metadata.name);
    expect(encrypted).not.toContain(metadata.relativePath);
    expect(encrypted).not.toContain(metadata.tags[0]);
    expect(decryptSensitiveMetadata(encrypted, key)).toEqual(metadata);
  });

  it("rejects invalid metadata keys", () => {
    expect(() => encryptSensitiveMetadata(metadata, randomBytes(16))).toThrow(
      "metadata key",
    );
  });
});
