import { NextResponse } from "next/server";
import { getUploadBatch } from "@/server/uploads/service";

interface UploadRouteContext {
  params: Promise<{ uploadId: string }>;
}

export async function GET(_request: Request, context: UploadRouteContext) {
  const { uploadId } = await context.params;
  const batch = getUploadBatch(uploadId, "demo-user");

  if (!batch) {
    return NextResponse.json({ error: "UPLOAD_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(batch);
}
