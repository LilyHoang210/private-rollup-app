import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUserId } from "@/server/auth/request-session";
import {
  createUploadBatch,
  failUploadBatch,
  markUploadBatchAvailable,
} from "@/server/uploads/service";
import { writeEncryptedPack } from "@/server/storage/shelby-writer";

export const runtime = "nodejs";
export const maxDuration = 300;

const itemSchema = z.object({
  localId: z.string().min(1),
  label: z.string().min(1).max(200),
  category: z.enum([
    "image",
    "video",
    "audio",
    "document",
    "dataset",
    "archive",
    "code",
    "other",
  ]),
  mimeType: z.string().max(200).optional(),
  plaintextSizeBytes: z.number().int().nonnegative(),
  ciphertextSizeBytes: z.number().int().nonnegative(),
  ciphertextSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  encryptedManifest: z.string().min(1),
  wrappedDek: z.string().min(1),
});

const requestSchema = z.object({
  idempotencyKey: z.string().min(1),
  retentionDays: z.union([z.literal(30), z.literal(90), z.literal(365)]),
  packBytesBase64: z.string().min(1).max(4_000_000),
  packSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  items: z.array(itemSchema).min(1).max(1000),
});

const MAX_PACK_BYTES = 2_750_000;

export async function POST(request: Request) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "UPLOAD_INVALID", message: "Encrypted upload request is invalid." },
      { status: 400 },
    );
  }

  const packBytes = Buffer.from(parsed.data.packBytesBase64, "base64");
  if (packBytes.byteLength > MAX_PACK_BYTES) {
    return NextResponse.json(
      {
        error: "UPLOAD_TOO_LARGE",
        message:
          "This deployment accepts encrypted packs up to 2.75 MB. Select fewer or smaller files.",
      },
      { status: 413 },
    );
  }

  const batch = createUploadBatch({
    userId,
    idempotencyKey: parsed.data.idempotencyKey,
    retentionDays: parsed.data.retentionDays,
    items: parsed.data.items,
  });

  try {
    const storage = await writeEncryptedPack({
      batchId: batch.id,
      bytes: packBytes,
      sha256: parsed.data.packSha256,
      retentionDays: parsed.data.retentionDays,
    });
    return NextResponse.json(
      markUploadBatchAvailable({ userId, batchId: batch.id, storage }),
      { status: 201 },
    );
  } catch (error) {
    failUploadBatch({ userId, batchId: batch.id });
    const message = friendlyShelbyError(error);
    return NextResponse.json(
      { error: "SHELBY_UPLOAD_FAILED", message },
      { status: 502 },
    );
  }
}

export function friendlyShelbyError(error: unknown) {
  const raw = error instanceof Error ? error.message : "";
  if (raw.includes("INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE")) {
    return "The storage service needs more Shelbynet APT for gas. No credit was charged; please try again after the operator refills it.";
  }
  if (/insufficient.*(Shelby|SHEL|USD|token)/i.test(raw)) {
    return "The storage service needs more Shelbynet storage tokens. No credit was charged; please try again after the operator refills it.";
  }
  if (raw.includes("429") || /rate limit/i.test(raw)) {
    return "Shelby is temporarily rate-limiting uploads. No credit was charged; please try again shortly.";
  }
  if (/location/i.test(raw)) {
    return "Shelby could not select a storage location. No credit was charged; the operator must check the location configuration.";
  }
  if (raw === "Shelby storage writer is not configured") return raw;
  return "Shelby could not complete and verify this upload. No credit was charged; please try again.";
}
