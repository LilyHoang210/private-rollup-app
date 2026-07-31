import { NextResponse } from "next/server";
import { z } from "zod";
import { authService } from "@/server/auth/runtime";

const challengeRequestSchema = z.object({
  walletAddress: z.string().min(1),
  domain: z.string().min(1),
  uri: z.string().url(),
  chainId: z.string().min(1),
});

export async function POST(request: Request) {
  const body = challengeRequestSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json(
      { error: "INVALID_AUTH_CHALLENGE_REQUEST" },
      { status: 400 },
    );
  }

  const challenge = await authService.createChallenge(body.data);

  return NextResponse.json({
    id: challenge.id,
    message: challenge.message,
    expiresAt: challenge.expiresAt.toISOString(),
  });
}
