import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../src/app/api/storage/status/route";

describe("storage status route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports Shelby writer as not ready when required configuration is missing", async () => {
    vi.stubEnv("SHELBY_DRIVER", "shelby");
    vi.stubEnv("SHELBY_NETWORK", "shelbynet");
    vi.stubEnv("SHELBY_API_URL", "");
    vi.stubEnv("SHELBY_CREDENTIAL_FILE", "");

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ready: false,
      driver: "shelby",
      network: "shelbynet",
      missing: ["SHELBY_API_URL", "SHELBY_CREDENTIAL_FILE"],
      mode: "control_plane_only",
    });
  });
});
