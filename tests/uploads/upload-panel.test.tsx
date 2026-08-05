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
    localStorage.clear();
    walletHookMock.mockReturnValue({
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
        if (url.includes("/api/apt-account")) {
          return Response.json(aptAccountFixture());
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
      screen.getByRole("button", { name: "Encrypt and join a pack" }),
    );

    expect(await screen.findByText(/Encrypted upload queued/i)).toBeVisible();
    const uploadCall = fetchMock.mock.calls.find(
      (call) => call[0] === "/api/uploads",
    );
    expect(uploadCall?.[1]).toMatchObject({ method: "POST" });
    expect(String(uploadCall?.[1]?.body)).not.toContain("super secret plaintext");
    expect(String(uploadCall?.[1]?.body)).not.toContain("Personal docs");
    expect(String(uploadCall?.[1]?.body)).not.toContain("packBytesBase64");
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
      return Response.json(aptAccountFixture());
    });

    render(<UploadPanel />);
    expect(await screen.findByText(/Storage writer is not configured/)).toBeVisible();
    await userEvent.upload(
      screen.getByLabelText("Select files"),
      new File(["hello"], "hello.txt", { type: "text/plain" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Encrypt and join a pack" }),
    );

    expect(await screen.findByText(/Shelby storage is not ready/)).toBeVisible();
    expect(fetchMock.mock.calls.some((call) => call[0] === "/api/uploads")).toBe(
      false,
    );
  });

  it("explains pack eligibility and blocks upload when available APT is below reserve", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("/api/storage/status")) {
        return Response.json(storageReadyFixture());
      }
      if (String(input).includes("/api/apt-account")) {
        return Response.json(aptAccountFixture({ availableOctas: 0 }));
      }
      return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    });

    render(<UploadPanel />);
    await userEvent.upload(
      screen.getByLabelText("Select files"),
      new File(["hello"], "hello.txt", { type: "text/plain" }),
    );

    expect(await screen.findByText("Pack Eligibility & Cost")).toBeVisible();
    expect(screen.getByText("Shared Pack")).toBeVisible();
    expect(screen.getByLabelText("Upload condition: 8.0 MiB pool or 5 minute wait")).toBeVisible();
    expect(screen.getByLabelText("Estimated reserve: 0.000015 APT")).toBeVisible();
    expect(screen.getByLabelText("Service wallet available: 0 APT")).toBeVisible();
    expect(screen.getByText(/Service wallet needs 0.000015 APT for this upload/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Deposit 0.000015 APT" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Encrypt and join a pack" })).toBeDisabled();
    expect(fetchMock.mock.calls.some((call) => call[0] === "/api/uploads")).toBe(false);
  });

  it("deposits missing APT from the connected wallet and auto-syncs service wallet availability", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/storage/status")) {
        return Response.json(storageReadyFixture());
      }
      if (url === "/api/apt-account") {
        return Response.json(aptAccountFixture({ availableOctas: 0 }));
      }
      if (url === "/api/apt-account/sync" && init?.method === "POST") {
        return Response.json(aptAccountFixture({ availableOctas: 1_500 }));
      }
      return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    });

    render(<UploadPanel />);
    await userEvent.upload(
      screen.getByLabelText("Select files"),
      new File(["hello"], "hello.txt", { type: "text/plain" }),
    );

    await userEvent.click(await screen.findByRole("button", { name: "Deposit 0.000015 APT" }));

    expect(signAndSubmitTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          function: "0x1::aptos_account::transfer",
          functionArguments: [`0x${"a".repeat(64)}`, 1_500],
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/apt-account/sync",
      expect.objectContaining({ method: "POST" }),
    );
    expect(await screen.findByLabelText("Service wallet available: 0.000015 APT")).toBeVisible();
    expect(screen.getByRole("button", { name: "Encrypt and join a pack" })).toBeEnabled();
  });

  it("shows the Shelby error and never fabricates a local completion", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/storage/status")) return Response.json(storageReadyFixture());
      if (url.includes("/api/apt-account")) return Response.json(aptAccountFixture());
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
      screen.getByRole("button", { name: "Encrypt and join a pack" }),
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

function aptAccountFixture(input?: { availableOctas?: number }) {
  const availableOctas = input?.availableOctas ?? 100_000_000;
  return {
    account: {
      balanceOctas: availableOctas,
      reservedOctas: 0,
      availableOctas,
      wallet: {
        address: `0x${"a".repeat(64)}`,
        network: "testnet",
        onChainBalanceOctas: 100_000_000,
      },
      ledger: [],
    },
  };
}

function uploadFixture(status: "staging" | "waiting_for_pack") {
  return {
    id: "batch-1",
    status,
    retentionDays: 90,
    totalCiphertextSizeBytes: 38,
    billing: { paymentStatus: "reserved", reserveOctas: 1_500 },
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
