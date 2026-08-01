import { NextResponse } from "next/server";
import { z } from "zod";
import { authService } from "@/server/auth/runtime";
import {
  createSessionCookie,
  createSessionToken,
  hashSessionToken,
} from "@/server/auth/session";

const verifyRequestSchema = z.object({
  challengeId: z.string().min(1),
  walletAddress: z.string().min(1),
  publicKey: z.string().min(1),
  domain: z.string().min(1),
  signature: z.string().min(1),
  fullMessage: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  const body = verifyRequestSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json(
      { error: "INVALID_AUTH_VERIFY_REQUEST" },
      { status: 400 },
    );
  }

  try {
    const verified = await authService.verifyChallenge(body.data);
    const sessionMaxAgeSeconds = 7 * 24 * 60 * 60;
    const token = createSessionToken({
      walletAddress: verified.walletAddress,
      walletAddressHash: verified.walletAddressHash,
      chainId: verified.chainId,
      maxAgeSeconds: sessionMaxAgeSeconds,
    });
    const response = NextResponse.json({
      chainId: verified.chainId,
      walletAddress: verified.walletAddress,
      walletAddressHash: verified.walletAddressHash,
      sessionTokenHash: hashSessionToken(token),
    });

    response.headers.set(
      "Set-Cookie",
      createSessionCookie({
        token,
        maxAgeSeconds: sessionMaxAgeSeconds,
        secure: process.env.NODE_ENV === "production",
      }),
    );

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "AUTH_VERIFICATION_FAILED",
      },
      { status: 401 },
    );
  }
}
