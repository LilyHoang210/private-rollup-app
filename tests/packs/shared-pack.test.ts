import { describe, expect, it } from "vitest";
import { assembleSharedPack } from "../../src/server/packs/shared-pack";

describe("shared encrypted pack assembly", () => {
  it("concatenates member packs and records exact non-overlapping byte ranges", async () => {
    const first = new Uint8Array([1, 2, 3]);
    const second = new Uint8Array([4, 5, 6, 7]);

    const result = await assembleSharedPack([
      { batchId: "batch-a", bytes: first },
      { batchId: "batch-b", bytes: second },
    ]);

    expect(result.bytes).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7]));
    expect(result.members).toEqual([
      {
        batchId: "batch-a",
        byteStart: 0,
        byteLength: 3,
        ciphertextSha256:
          "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81",
      },
      {
        batchId: "batch-b",
        byteStart: 3,
        byteLength: 4,
        ciphertextSha256:
          "c6d44cf418f610e3fe9e1d9294ff43def81c6cdcad6cbb1820cff48d3aa4355d",
      },
    ]);
    expect(result.sha256).toBe(
      "32bbe378a25091502b2baf9f7258c19444e7a43ee4593b08030acd790bd66e6a",
    );
  });

  it("rejects empty or duplicate batch members", async () => {
    await expect(assembleSharedPack([])).rejects.toThrow("at least one member");
    await expect(
      assembleSharedPack([
        { batchId: "same", bytes: new Uint8Array([1]) },
        { batchId: "same", bytes: new Uint8Array([2]) },
      ]),
    ).rejects.toThrow("unique batch IDs");
  });
});
