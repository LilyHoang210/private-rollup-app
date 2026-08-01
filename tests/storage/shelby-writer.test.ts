import { describe, expect, it, vi } from "vitest";
import { writeEncryptedPack } from "../../src/server/storage/shelby-writer";

describe("Shelby encrypted pack writer", () => {
  it("uploads with the service signer and verifies committed on-chain metadata", async () => {
    const upload = vi.fn().mockResolvedValue(undefined);
    const getFullObjectMetadata = vi.fn().mockResolvedValue({
      uid: BigInt(42),
      size: 4,
      isWritten: true,
      expirationMicros: 1_800_000_000_000_000,
    });
    const getBlobActivities = vi.fn().mockResolvedValue([
      {
        blobName: "private-rollup/batch-1.prp",
        type: "commit_object",
        transactionHash: "0xabc",
      },
    ]);
    const client = {
      upload,
      coordination: { getFullObjectMetadata, getBlobActivities },
    };
    const signer = { accountAddress: { toString: () => "0xservice" } };

    const result = await writeEncryptedPack(
      {
        batchId: "batch-1",
        bytes: new Uint8Array([1, 2, 3, 4]),
        sha256: "9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a",
        retentionDays: 30,
      },
      {
        now: () => new Date("2026-08-01T00:00:00.000Z"),
        config: {
          network: "shelbynet",
          privateKey: "secret",
          location: "shelbynet-1",
        },
        createSigner: () => signer as never,
        createClient: () => client as never,
      },
    );

    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({
        blobName: "private-rollup/batch-1.prp",
        options: { selectedLocation: "shelbynet-1" },
      }),
    );
    expect(result).toMatchObject({
      verified: true,
      ownerAddress: "0xservice",
      blobName: "private-rollup/batch-1.prp",
      blobId: "42",
      transactionHash: "0xabc",
      ciphertextSha256: "9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a",
    });
  });

  it("rejects a hash mismatch before spending funds", async () => {
    const upload = vi.fn();

    await expect(
      writeEncryptedPack(
        {
          batchId: "batch-1",
          bytes: new Uint8Array([1, 2, 3]),
          sha256: "0".repeat(64),
          retentionDays: 30,
        },
        {
          config: {
            network: "shelbynet",
            privateKey: "secret",
            location: "shelbynet-1",
          },
          createSigner: () => ({ accountAddress: { toString: () => "0xservice" } }) as never,
          createClient: () => ({ upload }) as never,
        },
      ),
    ).rejects.toThrow("Ciphertext pack checksum mismatch");
    expect(upload).not.toHaveBeenCalled();
  });
});
