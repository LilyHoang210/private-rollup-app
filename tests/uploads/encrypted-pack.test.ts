import { describe, expect, it } from "vitest";
import {
  buildEncryptedPack,
  parseEncryptedPack,
} from "../../src/client/uploads/encrypted-pack";

describe("encrypted pack format", () => {
  it("round-trips ciphertext and recovery metadata without plaintext", async () => {
    const plaintext = "family-photo.jpg";
    const pack = await buildEncryptedPack([
      {
        localId: "file-1",
        ciphertext: new Uint8Array([1, 2, 3, 4]),
        ciphertextSha256:
          "9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a",
        encryptedManifest: "opaque-manifest",
        wrappedDek: "opaque-wrapped-key",
        aad: "cHJpdmF0ZS1yb2xsdXA6ZmlsZS0x",
      },
    ]);

    const parsed = parseEncryptedPack(pack.bytes);

    expect(pack.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(parsed.items[0]).toMatchObject({
      localId: "file-1",
      ciphertext: "AQIDBA==",
    });
    expect(new TextDecoder().decode(pack.bytes)).not.toContain(plaintext);
  });
});
