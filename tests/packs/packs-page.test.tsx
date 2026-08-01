// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PacksPage from "../../src/app/app/packs/page";

describe("packs page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows an empty state instead of demo pack fixtures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ batches: [] }));

    render(<PacksPage />);

    expect(screen.getByRole("heading", { name: "Pack Participation" })).toBeVisible();
    expect(await screen.findByText("No pack participation yet")).toBeVisible();
    expect(screen.getByRole("link", { name: "Upload a test file" })).toHaveAttribute(
      "href",
      "/app/upload",
    );
    expect(screen.queryByText("Alpha-Genesis-92")).not.toBeInTheDocument();
    expect(screen.queryByText(/demo/i)).not.toBeInTheDocument();
  });

  it("shows queued upload batches waiting for shared pack assignment", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        batches: [
          {
            id: "c4b06f76-1111-4222-8333-123456789abc",
            status: "waiting_for_pack",
            retentionDays: 30,
            totalCiphertextSizeBytes: 115,
            createdAt: "2026-08-01T07:15:00.000Z",
            updatedAt: "2026-08-01T07:15:01.000Z",
            items: [
              {
                id: "item-1",
                batchId: "c4b06f76-1111-4222-8333-123456789abc",
                localId: "local-0",
                label: "QA smoke test",
                category: "document",
                plaintextSizeBytes: 99,
                ciphertextSizeBytes: 115,
                ciphertextSha256: "a".repeat(64),
                encryptedManifest: "manifest",
                wrappedDek: "dek",
                status: "waiting_for_pack",
                packStrategy: "shared_pack",
              },
            ],
          },
        ],
      }),
    );

    render(<PacksPage />);

    expect(await screen.findByText("QA smoke test")).toBeVisible();
    expect(screen.getByText("Waiting for pack")).toBeVisible();
    expect(screen.getByText("Shared pack")).toBeVisible();
    expect(screen.getByText("30 days")).toBeVisible();
  });
});
