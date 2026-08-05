import { describe, expect, it, vi } from "vitest";
import { settlePackWithVault } from "@/server/packs/worker";

describe("pack vault settlement", () => {
  it("settles successful pack members through the Payment Vault instead of local APT balances", async () => {
    const vault = {
      markUploadSuccess: vi
        .fn()
        .mockResolvedValueOnce({ transactionHash: "0xsettled-a" })
        .mockResolvedValueOnce({ transactionHash: "0xsettled-b" }),
    };

    const result = await settlePackWithVault({
      vault,
      packId: "pack_1",
      totalCostOctas: 80_000,
      members: [
        { vaultRequestId: "req_a", ciphertextBytes: 1_000 },
        { vaultRequestId: "req_b", ciphertextBytes: 3_000 },
      ],
    });

    expect(vault.markUploadSuccess).toHaveBeenCalledWith({
      requestId: "req_a",
      actualShelbyCostOctas: 20_000,
    });
    expect(vault.markUploadSuccess).toHaveBeenCalledWith({
      requestId: "req_b",
      actualShelbyCostOctas: 60_000,
    });
    expect(result).toEqual({
      packId: "pack_1",
      status: "settled",
      settlements: [
        { transactionHash: "0xsettled-a" },
        { transactionHash: "0xsettled-b" },
      ],
    });
  });
});
