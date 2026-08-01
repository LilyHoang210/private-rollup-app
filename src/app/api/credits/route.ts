import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/server/auth/request-session";
import { getCreditAccountRuntime } from "@/server/uploads/runtime-service";

export async function GET(request: Request) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  return NextResponse.json({ account: await getCreditAccountRuntime(userId) });
}
