import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/server/auth/request-session";

export async function GET(request: Request) {
  const session = getAuthenticatedSession(request);
  if (session) {
    return NextResponse.json({
      authenticated: true,
      chainId: session.chainId,
      walletAddressHash: session.walletAddressHash,
      expiresAt: session.expiresAt.toISOString(),
    });
  }

  return NextResponse.json({ authenticated: false });
}
