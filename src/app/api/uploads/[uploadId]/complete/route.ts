import { NextResponse } from "next/server";
import { z } from "zod";
import { DomainError } from "@/domain/errors";
import { completeUploadBatch } from "@/server/uploads/service";

interface CompleteUploadRouteContext {
  params: Promise<{ uploadId: string }>;
}

const completeUploadSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            localId: z.string().min(1),
            ciphertextSha256: z.string().regex(/^[a-f0-9]{64}$/i),
            stagingRef: z.string().min(1),
          })
          .strict(),
      )
      .min(1)
      .max(1000),
  })
  .strict();

export async function POST(request: Request, context: CompleteUploadRouteContext) {
  const body = completeUploadSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "UPLOAD_COMPLETE_INVALID" }, { status: 400 });
  }

  const { uploadId } = await context.params;
  try {
    const batch = completeUploadBatch({
      userId: "demo-user",
      batchId: uploadId,
      items: body.data.items,
    });

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
