import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/server/auth/request-session";
import { getAptAccountRuntime } from "@/server/uploads/runtime-service";

export async function GET(request: Request) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  try {
    return NextResponse.json({ account: await getAptAccountRuntime(userId) });
  } catch (error) {
    return NextResponse.json(
      {
        error: "APT_ACCOUNT_UNAVAILABLE",
        message: error instanceof Error ? error.message : "APT account is unavailable",
      },
      { status: 503 },
    );
  }
}
