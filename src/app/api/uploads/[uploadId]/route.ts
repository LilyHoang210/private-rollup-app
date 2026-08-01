import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/server/auth/request-session";
import { getUploadBatchRuntime } from "@/server/uploads/runtime-service";

interface UploadRouteContext {
  params: Promise<{ uploadId: string }>;
}

export async function GET(request: Request, context: UploadRouteContext) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const { uploadId } = await context.params;
  const batch = await getUploadBatchRuntime(uploadId, userId);

  if (!batch) {
    return NextResponse.json({ error: "UPLOAD_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(batch);
}
