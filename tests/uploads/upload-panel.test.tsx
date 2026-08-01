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
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
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
          items: [{ localId: "local-0", status: "waiting_for_pack" }],
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

    expect(await screen.findByText(/Batch queued/)).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/uploads");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(String(fetchMock.mock.calls[0][1]?.body)).not.toContain(
      "super secret plaintext",
    );
    expect(fetchMock.mock.calls[1][0]).toBe("/api/uploads/batch-1/complete");
  });
});
