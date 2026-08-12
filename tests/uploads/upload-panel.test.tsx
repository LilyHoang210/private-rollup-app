// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRecoveryKit } from "../../src/client/crypto/hpke";
import { saveLocalVaultPublicMaterial } from "../../src/client/vault/local-vault";
import { UploadPanel } from "../../src/features/upload/upload-panel";

const { signAndSubmitTransactionMock, stageUploadMock, walletHookMock } = vi.hoisted(() => ({
  signAndSubmitTransactionMock: vi.fn(),
  stageUploadMock: vi.fn(async (pathname: string) => ({
    pathname,
    url: `https://store.private.blob.vercel-storage.com/${pathname}`,
  })),
  walletHookMock: vi.fn(),
}));

vi.mock("@vercel/blob/client", () => ({ upload: stageUploadMock }));
vi.mock("@aptos-labs/wallet-adapter-react", () => ({
  useWallet: () => walletHookMock(),
}));

describe("upload panel", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    walletHookMock.mockReturnValue({
      account: { address: `0x${"c".repeat(64)}` },
      connected: true,
      signAndSubmitTransaction: signAndSubmitTransactionMock,
    });
    signAndSubmitTransactionMock.mockResolvedValue({ hash: `0x${"1".repeat(64)}` });
    saveLocalVaultPublicMaterial(await createRecoveryKit());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stages ciphertext directly and reports a queued shared pack", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        if (url.includes("/api/storage/status")) {
          return Response.json(storageReadyFixture());
        }
        if (url.includes("/api/payment-vault/quote")) {
          return Response.json(vaultQuoteFixture());
        }
        if (url === "/api/uploads" && init?.method === "POST") {
          return Response.json(uploadFixture("staging"), { status: 201 });
        }
        if (url.includes("/api/uploads/batch-1/complete") && init?.method === "POST") {
          return Response.json(uploadFixture("waiting_for_pack"));
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
      await screen.findByRole("button", { name: "Pay and upload" }),
    );

    expect(await screen.findByText(/Encrypted upload queued/i)).toBeVisible();
    expect(signAndSubmitTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          function: "0x42::payment_vault::upload_with_payment",
        }),
      }),
    );
    const uploadCall = fetchMock.mock.calls.find(
      (call) => call[0] === "/api/uploads",
    );
    expect(uploadCall?.[1]).toMatchObject({ method: "POST" });
    const uploadBody = JSON.parse(String(uploadCall?.[1]?.body)) as {
      encryptedSizeBytes: number;
      items: Array<{ ciphertextSizeBytes: number }>;
    };
    expect(uploadBody.encryptedSizeBytes).toBeGreaterThan(
      uploadBody.items.reduce((total, item) => total + item.ciphertextSizeBytes, 0),
    );
    expect(String(uploadCall?.[1]?.body)).not.toContain("super secret plaintext");
    expect(String(uploadCall?.[1]?.body)).not.toContain("Personal docs");
    expect(String(uploadCall?.[1]?.body)).not.toContain("packBytesBase64");
    expect(String(uploadCall?.[1]?.body)).toContain("vaultRequestId");
    expect(String(uploadCall?.[1]?.body)).toContain("reservationTransactionHash");
    expect(stageUploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^staging\/batch-1\/.+\.prp$/),
      expect.any(Blob),
      expect.objectContaining({ access: "private" }),
    );
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
      if (String(input).includes("/api/payment-vault/quote")) {
        return Response.json(vaultQuoteFixture());
      }
      return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    });

    render(<UploadPanel />);
    expect(await screen.findByText(/Storage writer is not configured/)).toBeVisible();
    await userEvent.upload(
      screen.getByLabelText("Select files"),
      new File(["hello"], "hello.txt", { type: "text/plain" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Pay and upload" }),
    );

    expect(await screen.findByText(/Shelby storage is not ready/)).toBeVisible();
    expect(fetchMock.mock.calls.some((call) => call[0] === "/api/uploads")).toBe(
      false,
    );
  });

  it("shows Payment Vault quote and does not mention service wallet credit", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("/api/storage/status")) {
        return Response.json(storageReadyFixture());
      }
      if (String(input).includes("/api/payment-vault/quote")) {
        return Response.json(vaultQuoteFixture());
      }
      return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    });

    render(<UploadPanel />);
    await userEvent.upload(
      screen.getByLabelText("Select files"),
      new File(["hello"], "hello.txt", { type: "text/plain" }),
    );

    expect(await screen.findByText("Pack Eligibility & Cost")).toBeVisible();
    expect(screen.getByText("Review upload cost")).toBeVisible();
    expect(screen.getByText("Shared Pack")).toBeVisible();
    expect(screen.getByLabelText("Upload condition: 8.0 MiB pool or 5 minute wait")).toBeVisible();
    expect(await screen.findByText("Shelby upload fee")).toBeVisible();
    expect(screen.getByText("Storage fee")).toBeVisible();
    expect(screen.getByText("Platform fee")).toBeVisible();
    expect(screen.getByText("Safety buffer")).toBeVisible();
    expect(screen.getByRole("button", { name: "Pay and upload" })).toBeEnabled();
    expect(screen.queryByText(/service wallet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/credit/i)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => call[0] === "/api/uploads")).toBe(false);
  });

  it("lets users initialize a missing vault from the upload flow and continue upload", async () => {
    localStorage.clear();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        if (url.includes("/api/storage/status")) {
          return Response.json(storageReadyFixture());
        }
        if (url.includes("/api/payment-vault/quote")) {
          return Response.json(vaultQuoteFixture());
        }
        if (url === "/api/vault" && init?.method === "POST") {
          return Response.json({ ownerFingerprint: "owner-fingerprint-1" });
        }
        if (url === "/api/uploads" && init?.method === "POST") {
          return Response.json(uploadFixture("staging"), { status: 201 });
        }
        if (url.includes("/api/uploads/batch-1/complete") && init?.method === "POST") {
          return Response.json(uploadFixture("waiting_for_pack"));
        }
        return Response.json({ error: "NOT_FOUND" }, { status: 404 });
      },
    );

    render(<UploadPanel />);
    await userEvent.upload(
      screen.getByLabelText("Select files"),
      new File(["hello"], "hello.txt", { type: "text/plain" }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Pay and upload" }));

    expect(
      await screen.findByText("Initialize your vault and save recovery-kit.json before uploading."),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Initialize Vault" }));
    expect(await screen.findByText(/Recovery kit downloaded/i)).toBeVisible();

    await userEvent.click(await screen.findByRole("button", { name: "Pay and upload" }));

    expect(await screen.findByText(/Encrypted upload queued/i)).toBeVisible();
    expect(signAndSubmitTransactionMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls.some((call) => call[0] === "/api/vault")).toBe(true);
  });

  it("blocks payment when the connected wallet is unavailable", async () => {
    walletHookMock.mockReturnValue({
      account: null,
      connected: false,
      signAndSubmitTransaction: signAndSubmitTransactionMock,
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/storage/status")) {
        return Response.json(storageReadyFixture());
      }
      if (url.includes("/api/payment-vault/quote")) {
        return Response.json(vaultQuoteFixture());
      }
      return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    });

    render(<UploadPanel />);
    await userEvent.upload(
      screen.getByLabelText("Select files"),
      new File(["hello"], "hello.txt", { type: "text/plain" }),
    );

    await userEvent.click(await screen.findByRole("button", { name: "Pay and upload" }));

    expect(await screen.findByText("Connect your Aptos wallet before paying for an upload.")).toBeVisible();
    expect(signAndSubmitTransactionMock).not.toHaveBeenCalled();
  });

  it("fails closed when the Payment Vault contract is not configured", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/storage/status")) {
        return Response.json(storageReadyFixture());
      }
      if (url.includes("/api/payment-vault/quote")) {
        return Response.json(vaultQuoteFixture({ contractAddress: "" }));
      }
      return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    });

    render(<UploadPanel />);
    await userEvent.upload(
      screen.getByLabelText("Select files"),
      new File(["hello"], "hello.txt", { type: "text/plain" }),
    );

    await userEvent.click(await screen.findByRole("button", { name: "Pay and upload" }));

    expect(await screen.findByText("Payment Vault contract is not configured.")).toBeVisible();
    expect(signAndSubmitTransactionMock).not.toHaveBeenCalled();
  });

  it("shows the Shelby error and never fabricates a local completion", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/storage/status")) return Response.json(storageReadyFixture());
      if (url.includes("/api/payment-vault/quote")) return Response.json(vaultQuoteFixture());
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
      await screen.findByRole("button", { name: "Pay and upload" }),
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

function vaultQuoteFixture(input?: { contractAddress?: string }) {
  return {
    quote: {
      encryptedSizeBytes: 1_048_576,
      retentionDays: "90",
      mode: "shared_pack",
      estimatedShelbyFeeOctas: 4_000,
      estimatedStorageFeeOctas: 196_608,
      platformFeeOctas: 10_031,
      safetyBufferOctas: 42_128,
      totalLockedOctas: 252_767,
      refundPolicy: "full_refund_before_success_settlement",
    },
    payment: {
      payer: "connected_wallet",
      receiver: "payment_vault_contract",
      contractAddress: input?.contractAddress ?? "0x42",
    },
  };
}

function uploadFixture(status: "staging" | "waiting_for_pack") {
  return {
    id: "batch-1",
    status,
    retentionDays: 90,
    totalCiphertextSizeBytes: 38,
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
        status,
        packStrategy: "shared_pack",
      },
    ],
  };
}
