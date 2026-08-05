import { describe, expect, it } from "vitest";
import { POST } from "../../src/app/api/storage/upload/route";

describe("legacy storage upload route", () => {
  it("is disabled so uploads cannot bypass durable pack settlement", async () => {
    const response = await POST();

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      error: "LEGACY_STORAGE_UPLOAD_DISABLED",
      message:
        "Use /api/uploads with Payment Vault reservation, private staging, and pack settlement.",
    });
  });
});
