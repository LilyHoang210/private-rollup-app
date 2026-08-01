import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/server/auth/request-session";
import { hasDatabaseConfiguration } from "@/server/db/client";
import { syncDurableAptDeposits } from "@/server/billing/durable-apt-service";

export async function POST(request: Request) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!hasDatabaseConfiguration()) {
    return NextResponse.json(
      { error: "DATABASE_REQUIRED", message: "APT deposit sync requires Postgres" },
      { status: 503 },
    );
  }
  try {
    return NextResponse.json({ account: await syncDurableAptDeposits(userId) });
  } catch (error) {
    return NextResponse.json(
      {
        error: "APT_SYNC_FAILED",
        message: error instanceof Error ? error.message : "APT deposit sync failed",
      },
      { status: 502 },
    );
  }
}
