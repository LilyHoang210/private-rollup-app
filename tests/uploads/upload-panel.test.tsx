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
      .mockResolvedValueOnce(
        Response.json({
          ready: false,
          driver: "shelby",
          network: "shelbynet",
          missing: ["SHELBY_API_URL", "SHELBY_CREDENTIAL_FILE"],
          mode: "control_plane_only",
        }),
      )
      .mockResolvedValueOnce(
        Response.json(
          {
            id: "batch-1",
            status: "staging",
            items: [{ localId: "local-0", ciphertextSha256: "f".repeat(64) }],
          },
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json({
          id: "batch-1",
          status: "waiting_for_pack",
          retentionDays: 90,
          totalCiphertextSizeBytes: 38,
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
        }),
      );

    render(<UploadPanel />);

    expect(screen.getByText("Choose files")).toBeVisible();
    expect(screen.queryByText(/Chọn|Không có tệp/i)).not.toBeInTheDocument();

    await userEvent.upload(
      screen.getByLabelText("Select files"),
      new File(["super secret plaintext"], "secret.txt", { type: "text/plain" }),
    );
    await userEvent.type(screen.getByLabelText("Private label"), "Personal docs");
    await userEvent.click(screen.getByRole("button", { name: "Encrypt and queue upload" }));

    expect(await screen.findByText(/batch queued/i)).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/storage/status");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/uploads");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST" });
    expect(String(fetchMock.mock.calls[1][1]?.body)).not.toContain(
      "super secret plaintext",
    );
    expect(fetchMock.mock.calls[2][0]).toBe("/api/uploads/batch-1/complete");
    expect(localStorage.getItem("private-rollup:upload-batches:v1")).toContain(
      "batch-1",
    );
  });

  it("shows storage readiness honestly when Shelby writer configuration is missing", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          ready: false,
          driver: "shelby",
          network: "shelbynet",
          missing: ["SHELBY_API_URL"],
        }),
      )
      .mockResolvedValueOnce(
        Response.json(
          {
            id: "batch-storage-status",
            status: "staging",
            items: [{ localId: "local-0", ciphertextSha256: "f".repeat(64) }],
          },
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json({
          id: "batch-storage-status",
          status: "waiting_for_pack",
          retentionDays: 90,
          totalCiphertextSizeBytes: 21,
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
        }),
      );

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
