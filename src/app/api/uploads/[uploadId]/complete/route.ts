import { NextResponse } from "next/server";
import { z } from "zod";
import { DomainError } from "@/domain/errors";
import { getAuthenticatedUserId } from "@/server/auth/request-session";
import { closeEligiblePack } from "@/server/packs/worker";
import { completeUploadBatchRuntime } from "@/server/uploads/runtime-service";

interface CompleteUploadRouteContext {
  params: Promise<{ uploadId: string }>;
}

const completeUploadSchema = z
  .object({
    stagingObjectKey: z.string().min(1),
    stagingObjectUrl: z.string().url(),
    packSha256: z.string().regex(/^[a-f0-9]{64}$/i),
    packSizeBytes: z.number().int().positive(),
  })
  .strict();

export async function POST(request: Request, context: CompleteUploadRouteContext) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const body = completeUploadSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "UPLOAD_COMPLETE_INVALID" }, { status: 400 });
  }

  const { uploadId } = await context.params;
  try {
    const batch = await completeUploadBatchRuntime({
      userId,
      batchId: uploadId,
      ...body.data,
    });
    void closeEligiblePack().catch(() => undefined);

    return NextResponse.json(batch);
  } catch (error) {
    if (error instanceof DomainError) {
      const status =
        error.code === "UPLOAD_NOT_FOUND"
          ? 404
          : error.code === "UPLOAD_CHECKSUM_MISMATCH"
            ? 409
            : 400;

      return NextResponse.json(
        { error: error.code, message: error.message },
        { status },
      );
    }

    throw error;
  }
}
