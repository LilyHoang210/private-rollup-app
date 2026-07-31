// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VaultSetupPanel } from "../../src/features/recovery/vault-setup";

describe("vault setup panel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers public vault material without sending secrets", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        ownerFingerprint: "a".repeat(64),
        algorithm: "DHKEM_X25519_HKDF_SHA256",
      }),
    );

    render(<VaultSetupPanel />);
    await userEvent.click(screen.getByRole("button", { name: "Initialize Vault" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/vault",
      expect.objectContaining({
        method: "POST",
        body: expect.not.stringContaining("recovery"),
      }),
    );
    expect(await screen.findByText(/Owner fingerprint/)).toBeVisible();
  });
});
