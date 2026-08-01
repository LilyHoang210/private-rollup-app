import { NextResponse } from "next/server";
import { getStorageDriverStatus } from "@/server/storage/storage-driver";

export async function GET() {
  return NextResponse.json(getStorageDriverStatus());
}
