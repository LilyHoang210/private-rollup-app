import { NextResponse } from "next/server";
import { getStorageDriverStatus } from "@/server/storage/storage-driver";
import { hasDatabaseConfiguration } from "@/server/db/client";

export async function GET() {
  const storage = getStorageDriverStatus();
  const infrastructureMissing = [
    !hasDatabaseConfiguration() ? "DATABASE_URL" : undefined,
    !process.env.BLOB_READ_WRITE_TOKEN?.trim() ? "BLOB_READ_WRITE_TOKEN" : undefined,
  ].filter((value): value is string => Boolean(value));
  return NextResponse.json({
    ...storage,
    ready: storage.ready && infrastructureMissing.length === 0,
    missing: [...storage.missing, ...infrastructureMissing],
    mode:
      storage.ready && infrastructureMissing.length === 0
        ? "durable_shared_packs"
        : "configuration_required",
  });
}
