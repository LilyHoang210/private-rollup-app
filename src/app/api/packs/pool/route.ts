import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/server/auth/request-session";
import { summarizePackPools } from "@/server/packs/pool-summary";
import { listUploadBatchesForUserRuntime } from "@/server/uploads/runtime-service";

export async function GET(request: Request) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const batches = await listUploadBatchesForUserRuntime(userId);
  return NextResponse.json({
    pools: summarizePackPools({
      now: new Date(),
      batches,
    }),
  });
}
