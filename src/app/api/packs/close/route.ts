import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUserId } from "@/server/auth/request-session";
import { closeEligiblePack } from "@/server/packs/worker";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({ batchId: z.string().uuid() }).strict();

export async function POST(request: Request) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const body = bodySchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "PACK_CLOSE_INVALID" }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await closeEligiblePack({
        forceBatchId: body.data.batchId,
        requestingUserId: userId,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "PACK_CLOSE_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "The encrypted pack could not be closed",
      },
      { status: 502 },
    );
  }
}
