import { NextResponse } from "next/server";
import { createExpiredSessionCookie } from "@/server/auth/session";

export async function POST() {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set(
    "Set-Cookie",
    createExpiredSessionCookie({
      secure: process.env.NODE_ENV === "production",
    }),
  );

  return response;
}
