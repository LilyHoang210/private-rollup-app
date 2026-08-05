import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      error: "LEGACY_STORAGE_UPLOAD_DISABLED",
      message:
        "Use /api/uploads with Payment Vault reservation, private staging, and pack settlement.",
    },
    { status: 410 },
  );
}
