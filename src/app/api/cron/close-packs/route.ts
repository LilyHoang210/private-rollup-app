import { NextResponse } from "next/server";
import { closeEligiblePack } from "@/server/packs/worker";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "CRON_UNAUTHORIZED" }, { status: 401 });
  }
  return NextResponse.json(await closeEligiblePack());
}
