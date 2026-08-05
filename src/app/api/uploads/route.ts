import { NextResponse } from "next/server";
import { z } from "zod";
import { DomainError } from "@/domain/errors";
import { getAuthenticatedUserId } from "@/server/auth/request-session";
import {
  createUploadBatchRuntime,
  listUploadBatchesForUserRuntime,
} from "@/server/uploads/runtime-service";

const uploadItemSchema = z
  .object({
    localId: z.string().min(1),
    label: z.string().min(1),
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
    mimeType: z.string().optional(),
    plaintextSizeBytes: z.number().int().nonnegative(),
    ciphertextSizeBytes: z.number().int().nonnegative(),
    ciphertextSha256: z.string().regex(/^[a-f0-9]{64}$/i),
    encryptedManifest: z.string().min(1),
    wrappedDek: z.string().min(1),
  })
  .strict();

const createUploadSchema = z
  .object({
    idempotencyKey: z.string().min(1),
    userAddress: z.string().regex(/^0x[a-fA-F0-9]+$/),
    vaultRequestId: z.string().min(1),
    reservationTransactionHash: z.string().regex(/^0x[a-fA-F0-9]+$/),
    reservationDeadlineSecs: z.number().int().positive(),
    retentionDays: z.union([z.literal(30), z.literal(90), z.literal(365)]),
    items: z.array(uploadItemSchema).min(1).max(1000),
  })
  .strict();

export async function GET(request: Request) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  return NextResponse.json({ batches: await listUploadBatchesForUserRuntime(userId) });
}

export async function POST(request: Request) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const body = createUploadSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "UPLOAD_INVALID" }, { status: 400 });
  }

  try {
    const batch = await createUploadBatchRuntime({
      userId,
      ...body.data,
      userAddress: body.data.userAddress as `0x${string}`,
    });

    return NextResponse.json(batch, { status: 201 });
  } catch (error) {
    return uploadErrorResponse(error);
  }
}

function uploadErrorResponse(error: unknown) {
  if (error instanceof DomainError) {
    const status = error.code === "VAULT_RESERVATION_REQUIRED" ? 402 : 400;
    return NextResponse.json(
      { error: "UPLOAD_INVALID", code: error.code, message: error.message },
      { status },
    );
  }

  throw error;
}
