import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestId = new URL(request.url).searchParams.get("requestId")?.trim();
  if (!requestId) {
    return NextResponse.json(
      { error: "VAULT_REQUEST_ID_REQUIRED" },
      { status: 400 },
    );
  }

  return NextResponse.json({ reservation: null }, { status: 404 });
}
