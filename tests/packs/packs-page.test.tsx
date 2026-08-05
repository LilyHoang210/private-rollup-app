// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("keeps pack pool rules visible when wallet-scoped pack data cannot load", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Auth required"));

    render(<PacksPage />);

    expect(await screen.findByText("Waiting Pack Pool")).toBeVisible();
    expect(screen.getByText(/Shared packs upload to Shelby/)).toBeVisible();
    expect(
      screen.getByText(
        "Pack pool progress is unavailable. Your upload list can still be inspected.",
      ),
    ).toBeVisible();
    expect(screen.getByText("Connect wallet to load pack queue")).toBeVisible();
  });

  it("shows queued upload batches waiting for shared pack assignment", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      Response.json(
        String(input).includes("/api/packs/pool")
          ? { pools: [poolFixture(30, 115)] }
          : { batches: [batchFixture("c4b06f76-1111-4222-8333-123456789abc", "QA smoke test", 115, 30, 25_000)] },
      ),
    );

    render(<PacksPage />);

    expect(await screen.findByText("QA smoke test")).toBeVisible();
    expect(screen.getByText("Waiting for pack")).toBeVisible();
    expect(screen.getByText("Shared pack")).toBeVisible();
    expect(screen.getByText("30 days")).toBeVisible();
    expect(screen.getByText("0.00025 APT")).toBeVisible();
  });

  it("shows waiting pack pool conditions and progress", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      Response.json(
        String(input).includes("/api/packs/pool")
          ? {
              pools: [
                {
                  retentionDays: 90,
                  queuedBytes: 897,
                  targetBytes: 8 * 1024 * 1024,
                  maxBytes: 50 * 1024 * 1024,
                  maxWaitSeconds: 300,
                  waitingBatchCount: 2,
                  progressRatio: 897 / (8 * 1024 * 1024),
                  closesAt: "2026-08-01T07:20:00.000Z",
                  secondsRemaining: 252,
                  trigger: "waiting",
                  nextTrigger: "wait_time",
                },
              ],
            }
          : {
              batches: [
                batchFixture("batch-a", "Pool upload A", 400),
                batchFixture("batch-b", "Pool upload B", 497),
              ],
            },
      ),
    );

    render(<PacksPage />);

    expect(await screen.findByText("Waiting Pack Pool")).toBeVisible();
    expect(screen.getByText("90-day pool")).toBeVisible();
    expect(screen.getByText("897 B / 8.0 MiB")).toBeVisible();
    expect(screen.getByText("2 waiting batches")).toBeVisible();
    expect(screen.getByText("Upload threshold")).toBeVisible();
    expect(screen.getAllByText("8.0 MiB")).not.toHaveLength(0);
    expect(screen.getByText("Maximum wait")).toBeVisible();
    expect(screen.getByText("05:00")).toBeVisible();
    expect(screen.getByText("Auto-upload in 04:12 unless the pool reaches 8.0 MiB first.")).toBeVisible();
  });

  it("shows all public retention pools including empty pools", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      Response.json(
        String(input).includes("/api/packs/pool")
          ? {
              pools: [
                poolFixture(30, 0, 0),
                poolFixture(90, 897, 2),
                poolFixture(365, 0, 0),
              ],
            }
          : { batches: [] },
      ),
    );

    render(<PacksPage />);

    expect(await screen.findByText("30-day pool")).toBeVisible();
    expect(screen.getByText("90-day pool")).toBeVisible();
    expect(screen.getByText("365-day pool")).toBeVisible();
    expect(screen.getAllByText("Waiting for files")).toHaveLength(2);
    expect(screen.getByText("897 B / 8.0 MiB")).toBeVisible();
  });

  it("filters pack rows by search text", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ batches: [batchFixture("batch-a", "Alpha archive", 100)] }),
    );

    render(<PacksPage />);

    expect(await screen.findByText("Alpha archive")).toBeVisible();

    await userEvent.type(screen.getByLabelText("Search packs"), "no-such-pack-query");

    expect(screen.queryByText("Alpha archive")).not.toBeInTheDocument();
    expect(screen.getByText("No matching packs")).toBeVisible();
  });

  it("hides waiting batches when the verified filter is selected", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ batches: [batchFixture("batch-a", "Waiting archive", 100)] }),
    );

    render(<PacksPage />);

    expect(await screen.findByText("Waiting archive")).toBeVisible();

    await userEvent.selectOptions(screen.getByLabelText("Filter status"), "verified");

    expect(screen.queryByText("Waiting archive")).not.toBeInTheDocument();
    expect(screen.getByText("No matching packs")).toBeVisible();
  });

  it("sorts pack rows by largest contribution", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        batches: [
          batchFixture("batch-small", "Small upload", 100),
          batchFixture("batch-large", "Large upload", 500),
        ],
      }),
    );

    render(<PacksPage />);

    expect(await screen.findByText("Small upload")).toBeVisible();

    await userEvent.selectOptions(screen.getByLabelText("Sort packs"), "bytes");

    const rows = screen.getAllByRole("article");
    expect(rows[0]).toHaveTextContent("Large upload");
    expect(rows[1]).toHaveTextContent("Small upload");
  });
});

function batchFixture(
  id: string,
  label: string,
  totalCiphertextSizeBytes: number,
  retentionDays: 30 | 90 | 365 = 90,
  reserveOctas = totalCiphertextSizeBytes * 10,
) {
  return {
    id,
    status: "waiting_for_pack",
    retentionDays,
    totalCiphertextSizeBytes,
    billing: {
      paymentStatus: "reserved",
      reserveOctas,
    },
    createdAt: id === "batch-large" ? "2026-08-01T07:16:00.000Z" : "2026-08-01T07:15:00.000Z",
    updatedAt: "2026-08-01T07:15:01.000Z",
    items: [
      {
        id: `${id}-item`,
        batchId: id,
        localId: "local-0",
        label,
        category: "document",
        plaintextSizeBytes: totalCiphertextSizeBytes - 16,
        ciphertextSizeBytes: totalCiphertextSizeBytes,
        ciphertextSha256: "a".repeat(64),
        encryptedManifest: "manifest",
        wrappedDek: "dek",
        status: "waiting_for_pack",
        packStrategy: "shared_pack",
      },
    ],
  };
}

function poolFixture(
  retentionDays: 30 | 90 | 365,
  queuedBytes: number,
  waitingBatchCount = 1,
) {
  return {
    retentionDays,
    queuedBytes,
    targetBytes: 8 * 1024 * 1024,
    maxBytes: 50 * 1024 * 1024,
    maxWaitSeconds: 300,
    waitingBatchCount,
    progressRatio: queuedBytes / (8 * 1024 * 1024),
    secondsRemaining: waitingBatchCount > 0 ? 240 : undefined,
    trigger: "waiting",
    nextTrigger: "wait_time",
  };
}
