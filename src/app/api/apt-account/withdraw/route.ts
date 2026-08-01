import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedSession } from "@/server/auth/request-session";
import { withdrawDurableApt } from "@/server/billing/durable-apt-service";

const withdrawalSchema = z.object({
  amountOctas: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  idempotencyKey: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  const session = getAuthenticatedSession(request);
  if (!session?.walletAddress) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }
  const body = withdrawalSchema.safeParse(await request.json().catch(() => undefined));
  if (!body.success) {
    return NextResponse.json(
      { error: "WITHDRAWAL_INVALID", message: "Enter a valid APT amount" },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(
      await withdrawDurableApt({
        externalUserId: `wallet:${session.walletAddressHash}`,
        destination: session.walletAddress,
        ...body.data,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "WITHDRAWAL_FAILED",
        message: error instanceof Error ? error.message : "APT withdrawal failed",
      },
      { status: 409 },
    );
  }
}
