// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UploadPanel } from "../../src/features/upload/upload-panel";

describe("upload panel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates and completes an encrypted metadata upload without sending plaintext bytes", async () => {
    localStorage.clear();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.includes("/api/storage/status")) {
          return Response.json({
          ready: false,
          driver: "shelby",
          network: "shelbynet",
          missing: ["SHELBY_API_URL", "SHELBY_CREDENTIAL_FILE"],
          mode: "control_plane_only",
          });
        }
        if (url.includes("/api/credits")) {
          return Response.json(creditFixture());
        }
        if (url === "/api/uploads" && init?.method === "POST") {
          return Response.json(
            {
            id: "batch-1",
            status: "staging",
            items: [{ localId: "local-0", ciphertextSha256: "f".repeat(64) }],
            },
            { status: 201 },
          );
        }
        return Response.json({
          id: "batch-1",
          status: "waiting_for_pack",
          retentionDays: 90,
          totalCiphertextSizeBytes: 38,
          billing: {
            creditStatus: "reserved",
            reserveMicrocredits: 1_500,
          },
          createdAt: "2026-08-01T07:15:00.000Z",
          updatedAt: "2026-08-01T07:15:01.000Z",
          items: [
            {
              id: "item-1",
              localId: "local-0",
              label: "Personal docs",
              category: "document",
              plaintextSizeBytes: 22,
              ciphertextSizeBytes: 38,
              ciphertextSha256: "f".repeat(64),
              encryptedManifest: "manifest",
              wrappedDek: "dek",
              status: "waiting_for_pack",
              packStrategy: "shared_pack",
            },
          ],
        });
      });

    render(<UploadPanel />);

    expect(screen.getByText("Choose files")).toBeVisible();
    expect(
      screen.queryByText(new RegExp("\\u0043h\\u1ecdn|Kh\\u00f4ng c\\u00f3 t\\u1ec7p", "i")),
    ).not.toBeInTheDocument();

    await userEvent.upload(
      screen.getByLabelText("Select files"),
      new File(["super secret plaintext"], "secret.txt", { type: "text/plain" }),
    );
    await userEvent.type(screen.getByLabelText("Private label"), "Personal docs");
    expect(await screen.findByText(/Estimated reserve/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Encrypt and queue upload" }));

    expect(await screen.findByText(/batch queued/i)).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith("/api/storage/status");
    expect(fetchMock).toHaveBeenCalledWith("/api/credits");
    const createUploadCall = fetchMock.mock.calls.find((call) => call[0] === "/api/uploads");
    expect(createUploadCall?.[1]).toMatchObject({ method: "POST" });
    expect(String(createUploadCall?.[1]?.body)).not.toContain(
      "super secret plaintext",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/uploads/batch-1/complete",
      expect.objectContaining({ method: "POST" }),
    );
    expect(localStorage.getItem("private-rollup:upload-batches:v1")).toContain(
      "batch-1",
    );
  });

  it("shows storage readiness honestly when Shelby writer configuration is missing", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.includes("/api/storage/status")) {
          return Response.json({
          ready: false,
          driver: "shelby",
          network: "shelbynet",
          missing: ["SHELBY_API_URL"],
            mode: "control_plane_only",
          });
        }
        if (url.includes("/api/credits")) {
          return Response.json(creditFixture());
        }
        if (url === "/api/uploads" && init?.method === "POST") {
          return Response.json(
            {
            id: "batch-storage-status",
            status: "staging",
            items: [{ localId: "local-0", ciphertextSha256: "f".repeat(64) }],
            },
            { status: 201 },
          );
        }
        return Response.json({
          id: "batch-storage-status",
          status: "waiting_for_pack",
          retentionDays: 90,
          totalCiphertextSizeBytes: 21,
          billing: {
            creditStatus: "reserved",
            reserveMicrocredits: 500,
          },
          items: [
            {
              id: "item-1",
              localId: "local-0",
              label: "Chain status test",
              category: "document",
              plaintextSizeBytes: 5,
              ciphertextSizeBytes: 21,
              ciphertextSha256: "f".repeat(64),
              encryptedManifest: "manifest",
              wrappedDek: "dek",
              status: "waiting_for_pack",
              packStrategy: "shared_pack",
            },
          ],
        });
      });

    render(<UploadPanel />);

    expect(await screen.findByText(/Storage writer is not configured/)).toBeVisible();

    await userEvent.upload(
      screen.getByLabelText("Select files"),
      new File(["hello"], "hello.txt", { type: "text/plain" }),
    );
    await userEvent.type(screen.getByLabelText("Private label"), "Chain status test");
    await userEvent.click(screen.getByRole("button", { name: "Encrypt and queue upload" }));

    expect(await screen.findByText(/Control-plane batch queued/)).toBeVisible();
    expect(screen.getByText(/No Shelby or Aptos transaction has been submitted/)).toBeVisible();
  });
});

function creditFixture() {
  return {
    account: {
      balanceMicrocredits: 100_000_000,
      reservedMicrocredits: 0,
      availableMicrocredits: 100_000_000,
      ledger: [],
    },
  };
}
