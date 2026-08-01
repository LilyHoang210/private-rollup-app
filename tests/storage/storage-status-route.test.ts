import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../src/app/api/storage/status/route";

describe("storage status route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports Shelby writer as not ready when required configuration is missing", async () => {
    vi.stubEnv("SHELBY_DRIVER", "shelby");
    vi.stubEnv("SHELBY_NETWORK", "shelbynet");
    vi.stubEnv("SHELBY_ACCOUNT_PRIVATE_KEY", "");
    vi.stubEnv("SHELBY_LOCATION", "");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ready: false,
      driver: "shelby",
      network: "shelbynet",
      missing: [
        "SHELBY_ACCOUNT_PRIVATE_KEY",
        "SHELBY_LOCATION",
        "DATABASE_URL",
        "BLOB_READ_WRITE_TOKEN",
      ],
      mode: "configuration_required",
    });
  });

  it("reports the real Shelby writer ready with a signer and location", async () => {
    vi.stubEnv("SHELBY_DRIVER", "shelby");
    vi.stubEnv("SHELBY_NETWORK", "shelbynet");
    vi.stubEnv("SHELBY_ACCOUNT_PRIVATE_KEY", "ed25519-priv-0xsecret");
    vi.stubEnv("SHELBY_LOCATION", "shelbynet-1");
    vi.stubEnv("DATABASE_URL", "postgres://example.test/private-rollup");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_test");

    const response = await GET();

    await expect(response.json()).resolves.toMatchObject({
      ready: true,
      driver: "shelby",
      network: "shelbynet",
      missing: [],
      mode: "durable_shared_packs",
    });
  });
});
