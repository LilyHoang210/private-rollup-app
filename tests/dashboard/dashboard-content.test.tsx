// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "../../src/app/app/page";

describe("dashboard content", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("does not show demo pack data before real user data exists", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("/api/apt-account")) {
        return Response.json(aptAccountFixture());
      }
      return Response.json({ batches: [] });
    });

    render(<DashboardPage />);

    expect(screen.getByRole("heading", { name: "Dashboard Overview" })).toBeVisible();
    expect(await screen.findByText("Service wallet")).toBeVisible();
    expect(screen.getAllByText("1 APT").length).toBeGreaterThan(0);
    expect(await screen.findByText("No live packs yet")).toBeVisible();
    expect(
      screen
        .getAllByRole("link", { name: "Start setup" })
        .every((link) => link.getAttribute("href") === "/app/setup"),
    ).toBe(true);
    expect(screen.queryByText("Alpha-Genesis-92")).not.toBeInTheDocument();
    expect(screen.queryByText("Beta-Storage-04")).not.toBeInTheDocument();
    expect(screen.queryByText("1,048")).not.toBeInTheDocument();
  });

  it("shows queued encrypted uploads from the current wallet session", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("/api/apt-account")) {
        return Response.json(aptAccountFixture({ reservedOctas: 25_000 }));
      }
      return Response.json({
        batches: [
          {
            id: "c4b06f76-1111-4222-8333-123456789abc",
            status: "waiting_for_pack",
            retentionDays: 30,
            totalCiphertextSizeBytes: 115,
            billing: {
              paymentStatus: "reserved",
              reserveOctas: 25_000,
            },
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
      });
    });

    render(<DashboardPage />);

    expect(await screen.findByText("QA smoke test")).toBeVisible();
    expect(screen.getByText("Queued Batches")).toBeVisible();
    expect(screen.getByText(/1 file/)).toBeVisible();
    expect(screen.getByText("115 B")).toBeVisible();
    expect(screen.getByText("Reserved: 0.00025 APT")).toBeVisible();
  });

  it("renders dashboard metrics as comfortable horizontal rows", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("/api/apt-account")) {
        return Response.json(aptAccountFixture());
      }
      return Response.json({
        batches: [
          uploadBatchFixture("batch-a", 400),
          uploadBatchFixture("batch-b", 497),
        ],
      });
    });

    render(<DashboardPage />);

    const queuedBatches = await screen.findByLabelText("Queued Batches: 2");
    const queuedBytes = screen.getByLabelText("Queued Bytes: 897 B");

    expect(queuedBatches.parentElement).toHaveClass("lg:col-span-3", "self-start");
    expect(queuedBatches).toHaveClass("flex-row", "items-center", "justify-between");
    expect(queuedBytes).toHaveClass("flex-row", "items-center", "justify-between");
    expect(screen.getByText("897 B")).toHaveClass("whitespace-nowrap");
  });

  it("shows locally cached uploads when the serverless API returns a stale empty list", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("/api/apt-account")) {
        return Response.json(aptAccountFixture());
      }
      return Response.json({ batches: [] });
    });
    localStorage.setItem(
      "private-rollup:upload-batches:v1",
      JSON.stringify([
        {
          id: "local-cache-batch-1",
          status: "waiting_for_pack",
          retentionDays: 365,
              totalCiphertextSizeBytes: 128,
              billing: {
                paymentStatus: "reserved",
                reserveOctas: 30_000,
              },
              createdAt: "2026-08-01T07:15:00.000Z",
          updatedAt: "2026-08-01T07:15:01.000Z",
          items: [
            {
              id: "item-1",
              localId: "local-0",
              label: "Cached QA upload",
              category: "dataset",
              plaintextSizeBytes: 112,
              ciphertextSizeBytes: 128,
              ciphertextSha256: "c".repeat(64),
              encryptedManifest: "manifest",
              wrappedDek: "dek",
              status: "waiting_for_pack",
              packStrategy: "shared_pack",
            },
          ],
        },
      ]),
    );

    render(<DashboardPage />);

    expect(await screen.findByText("Cached QA upload")).toBeVisible();
    expect(screen.getByText("128 B")).toBeVisible();
  });
});

function aptAccountFixture(input?: { reservedOctas?: number }) {
  const reservedOctas = input?.reservedOctas ?? 0;
  return {
    account: {
      balanceOctas: 100_000_000,
      reservedOctas,
      availableOctas: 100_000_000 - reservedOctas,
      wallet: {
        address: `0x${"a".repeat(64)}`,
        network: "testnet",
        onChainBalanceOctas: 100_000_000,
      },
      ledger: [
        {
          id: "entry-1",
          type: "wallet_deposit",
          amountOctas: 100_000_000,
          reservedDeltaOctas: 0,
          createdAt: "2026-08-01T07:15:00.000Z",
        },
      ],
    },
  };
}

function uploadBatchFixture(id: string, totalCiphertextSizeBytes: number) {
  return {
    id,
    status: "waiting_for_pack",
    retentionDays: 90,
    totalCiphertextSizeBytes,
    billing: {
      paymentStatus: "reserved",
      reserveOctas: 25_000,
    },
    createdAt: "2026-08-01T07:15:00.000Z",
    updatedAt: "2026-08-01T07:15:01.000Z",
    items: [
      {
        id: `${id}-item`,
        batchId: id,
        localId: `${id}-local`,
        label: `${id} upload`,
        category: "document",
        plaintextSizeBytes: totalCiphertextSizeBytes - 16,
        ciphertextSizeBytes: totalCiphertextSizeBytes,
        ciphertextSha256: "b".repeat(64),
        encryptedManifest: "manifest",
        wrappedDek: "dek",
        status: "waiting_for_pack",
        packStrategy: "shared_pack",
      },
    ],
  };
}
