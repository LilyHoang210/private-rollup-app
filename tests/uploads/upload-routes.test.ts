import { afterEach, describe, expect, it } from "vitest";
import { GET as listUploads, POST as createUpload } from "../../src/app/api/uploads/route";
import { GET as getUpload } from "../../src/app/api/uploads/[uploadId]/route";
import { POST as completeUpload } from "../../src/app/api/uploads/[uploadId]/complete/route";
import {
  createSessionCookie,
  createSessionToken,
} from "../../src/server/auth/session";
import { resetCreditStoreForTests } from "../../src/server/billing/credit-service";
import { resetUploadStoreForTests } from "../../src/server/uploads/service";

describe("upload API routes", () => {
  afterEach(() => {
    resetUploadStoreForTests();
    resetCreditStoreForTests();
  });

  it("creates, reads, and completes an encrypted upload batch", async () => {
    const createResponse = await createUpload(
      new Request("http://localhost/api/uploads", {
        method: "POST",
        headers: authHeaders("a".repeat(64)),
        body: JSON.stringify({
          idempotencyKey: "route-idem-1",
          retentionDays: 90,
          items: [
            {
              localId: "file-1",
              label: "Passport scan",
              category: "document",
              mimeType: "application/pdf",
              plaintextSizeBytes: 1000,
              ciphertextSizeBytes: 1016,
              ciphertextSha256: "d".repeat(64),
              encryptedManifest: "encrypted-manifest",
              wrappedDek: "hpke-wrapped-dek",
            },
          ],
        }),
      }),
    );
    const created = await createResponse.json();

    expect(createResponse.status).toBe(201);
    expect(created.status).toBe("staging");
    expect(created.items[0].packStrategy).toBe("shared_pack");
    expect(created.billing).toMatchObject({
      creditStatus: "reserved",
      reserveMicrocredits: expect.any(Number),
    });

    const getResponse = await getUpload(
      new Request(`http://localhost/api/uploads/${created.id}`, {
        headers: authHeaders("a".repeat(64)),
      }),
      { params: Promise.resolve({ uploadId: created.id }) },
    );
    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toMatchObject({
      id: created.id,
      status: "staging",
    });

    const completeResponse = await completeUpload(
      new Request(`http://localhost/api/uploads/${created.id}/complete`, {
        method: "POST",
        headers: authHeaders("a".repeat(64)),
        body: JSON.stringify({
          items: [
            {
              localId: "file-1",
              ciphertextSha256: "d".repeat(64),
              stagingRef: "staging://uploads/file-1",
            },
          ],
        }),
      }),
      { params: Promise.resolve({ uploadId: created.id }) },
    );

    expect(completeResponse.status).toBe(200);
    await expect(completeResponse.json()).resolves.toMatchObject({
      id: created.id,
      status: "waiting_for_pack",
      billing: {
        creditStatus: "reserved",
        reserveMicrocredits: created.billing.reserveMicrocredits,
      },
    });

    const listResponse = await listUploads(
      new Request("http://localhost/api/uploads", {
        headers: authHeaders("a".repeat(64)),
      }),
    );
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      batches: [
        {
          id: created.id,
          status: "waiting_for_pack",
          billing: {
            creditStatus: "reserved",
            reserveMicrocredits: created.billing.reserveMicrocredits,
          },
          items: [{ label: "Passport scan" }],
        },
      ],
    });
  });

  it("returns 400 when upload metadata contains plaintext payload fields", async () => {
    const response = await createUpload(
      new Request("http://localhost/api/uploads", {
        method: "POST",
        headers: authHeaders("a".repeat(64)),
        body: JSON.stringify({
          idempotencyKey: "route-idem-plaintext",
          retentionDays: 90,
          items: [
            {
              localId: "file-1",
              label: "Leaky file",
              category: "document",
              plaintextSizeBytes: 1000,
              ciphertextSizeBytes: 1016,
              ciphertextSha256: "e".repeat(64),
              encryptedManifest: "encrypted-manifest",
              wrappedDek: "hpke-wrapped-dek",
              plaintextBytes: "leak",
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "UPLOAD_INVALID",
    });
  });

  it("requires a wallet session before creating upload batches", async () => {
    const response = await createUpload(
      new Request("http://localhost/api/uploads", {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: "route-idem-unauthenticated",
          retentionDays: 90,
          items: [],
        }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "AUTH_REQUIRED",
    });
  });
});

function authHeaders(walletAddressHash: string) {
  const token = createSessionToken({
    walletAddressHash,
    chainId: "aptos-testnet",
    maxAgeSeconds: 60,
    secret: "private-rollup-dev-session-secret",
  });
  const cookie = createSessionCookie({
    token,
    maxAgeSeconds: 60,
    secure: false,
  }).split(";")[0];

  return { Cookie: cookie };
}
