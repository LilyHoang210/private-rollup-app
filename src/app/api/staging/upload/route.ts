import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/server/auth/request-session";
import { authorizeStagingUpload } from "@/server/staging/authorization";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  const userId = getAuthenticatedUserId(request);

  try {
    const response = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const authorization = authorizeStagingUpload({
          pathname,
          clientPayload,
          userId,
        });
        return {
          allowedContentTypes: authorization.allowedContentTypes,
          maximumSizeInBytes: authorization.maximumSizeInBytes,
          addRandomSuffix: false,
          allowOverwrite: false,
          validUntil: Date.now() + 10 * 60 * 1000,
          tokenPayload: JSON.stringify({
            batchId: authorization.batchId,
            userId: authorization.userId,
          }),
        };
      },
      onUploadCompleted: async () => {
        // Completion is finalized by the authenticated /api/uploads/:id/complete
        // request, which validates the returned private object URL and checksum.
      },
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error: "STAGING_UPLOAD_REJECTED",
        message: error instanceof Error ? error.message : "Staging upload failed",
      },
      { status: userId ? 400 : 401 },
    );
  }
}
