// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRecoveryKit } from "../../src/client/crypto/hpke";
import { saveLocalVaultPublicMaterial } from "../../src/client/vault/local-vault";
import { UploadPanel } from "../../src/features/upload/upload-panel";

describe("upload panel", () => {
  beforeEach(async () => {
    localStorage.clear();
    saveLocalVaultPublicMaterial(await createRecoveryKit());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads an encrypted pack and reports only verified Shelby success", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        if (url.includes("/api/storage/status")) {
          return Response.json(storageReadyFixture());
        }
        if (url.includes("/api/credits")) {
          return Response.json(creditFixture());
        }
        if (url === "/api/storage/upload" && init?.method === "POST") {
          return Response.json(uploadFixture(), { status: 201 });
        }
        return Response.json({ error: "NOT_FOUND" }, { status: 404 });
      },
    );

    render(<UploadPanel />);
    await userEvent.upload(
      screen.getByLabelText("Select files"),
      new File(["super secret plaintext"], "secret.txt", { type: "text/plain" }),
    );
    await userEvent.type(screen.getByLabelText("Private local label"), "Personal docs");
    await userEvent.click(
      screen.getByRole("button", { name: "Encrypt and upload to Shelby" }),
    );

    expect(await screen.findByText(/Verified Shelby upload/i)).toBeVisible();
    expect(screen.getByText("private-rollup/batch-1.prp")).toBeVisible();
    const uploadCall = fetchMock.mock.calls.find(
      (call) => call[0] === "/api/storage/upload",
    );
    expect(uploadCall?.[1]).toMatchObject({ method: "POST" });
    expect(String(uploadCall?.[1]?.body)).not.toContain("super secret plaintext");
    expect(String(uploadCall?.[1]?.body)).not.toContain("Personal docs");
    expect(String(uploadCall?.[1]?.body)).toContain("packBytesBase64");
    expect(localStorage.getItem("private-rollup:upload-batches:v1")).toContain(
      "batch-1",
    );
  });

  it("fails closed when Shelby writer configuration is missing", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("/api/storage/status")) {
        return Response.json({
          ready: false,
          driver: "shelby",
          network: "shelbynet",
          missing: ["SHELBY_API_KEY"],
          mode: "control_plane_only",
        });
      }
      return Response.json(creditFixture());
    });

    render(<UploadPanel />);
    expect(await screen.findByText(/Storage writer is not configured/)).toBeVisible();
    await userEvent.upload(
      screen.getByLabelText("Select files"),
      new File(["hello"], "hello.txt", { type: "text/plain" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Encrypt and upload to Shelby" }),
    );

    expect(await screen.findByText(/Shelby storage is not ready/)).toBeVisible();
    expect(fetchMock.mock.calls.some((call) => call[0] === "/api/storage/upload")).toBe(
      false,
    );
  });

  it("shows the Shelby error and never fabricates a local completion", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/storage/status")) return Response.json(storageReadyFixture());
      if (url.includes("/api/credits")) return Response.json(creditFixture());
      return Response.json(
        { message: "Shelby account needs more storage tokens." },
        { status: 502 },
      );
    });

    render(<UploadPanel />);
    await userEvent.upload(
      screen.getByLabelText("Select files"),
      new File(["hello"], "hello.txt", { type: "text/plain" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Encrypt and upload to Shelby" }),
    );

    expect(
      await screen.findByText("Shelby account needs more storage tokens."),
    ).toBeVisible();
    expect(screen.queryByText(/Verified Shelby upload/)).not.toBeInTheDocument();
    expect(localStorage.getItem("private-rollup:upload-batches:v1")).toBeNull();
  });
});

function storageReadyFixture() {
  return {
    ready: true,
    driver: "shelby",
    network: "shelbynet",
    missing: [],
    mode: "ready",
  };
}

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

function uploadFixture() {
  return {
    id: "batch-1",
    status: "available",
    retentionDays: 90,
    totalCiphertextSizeBytes: 38,
    billing: { creditStatus: "reserved", reserveMicrocredits: 1_500 },
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
        status: "available",
        packStrategy: "shared_pack",
      },
    ],
    storage: {
      driver: "shelby",
      network: "shelbynet",
      verified: true,
      ownerAddress: "0xservice",
      blobId: "42",
      blobName: "private-rollup/batch-1.prp",
      blobSizeBytes: 100,
      ciphertextSha256: "a".repeat(64),
      transactionHash: "0xabc",
      expiresAt: "2026-10-30T00:00:00.000Z",
      downloadUrl:
        "https://api.shelbynet.shelby.xyz/shelby/v1/blobs/0xservice/private-rollup/batch-1.prp",
    },
  };
}
