import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/server/auth/request-session";
import { getDatabase, hasDatabaseConfiguration } from "@/server/db/client";
import { users, vaultUploadRequests } from "@/server/db/schema";

const PENDING_STATUSES = new Set(["reserved", "registering", "uploading"]);

export async function GET(request: Request) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const requestId = new URL(request.url).searchParams.get("requestId")?.trim();
  const contractAddress = process.env.PAYMENT_VAULT_CONTRACT_ADDRESS?.trim() || "";

  if (!hasDatabaseConfiguration()) {
    return NextResponse.json({
      contractAddress,
      reservedOctas: 0,
      refundableOctas: 0,
      reservations: [],
    });
  }

  const walletAddressHash = userId.startsWith("wallet:") ? userId.slice(7) : userId;
  const db = getDatabase();
  const user = await db.query.users.findFirst({
    where: eq(users.walletAddressHash, walletAddressHash),
  });
  if (!user) {
    return NextResponse.json({
      contractAddress,
      reservedOctas: 0,
      refundableOctas: 0,
      reservations: [],
    });
  }

  const reservations = await db.query.vaultUploadRequests.findMany({
    where: eq(vaultUploadRequests.userId, user.id),
    orderBy: [desc(vaultUploadRequests.createdAt)],
    limit: 25,
  });
  const filtered = requestId
    ? reservations.filter((reservation) => reservation.requestId === requestId)
    : reservations;

  return NextResponse.json({
    contractAddress,
    reservedOctas: filtered
      .filter((reservation) => PENDING_STATUSES.has(reservation.status))
      .reduce((total, reservation) => total + reservation.totalLockedOctas, 0),
    refundableOctas: filtered.reduce(
      (total, reservation) => total + reservation.refundableOctas,
      0,
    ),
    reservations: filtered.map((reservation) => ({
      requestId: reservation.requestId,
      status: reservation.status,
      totalLockedOctas: reservation.totalLockedOctas,
      refundableOctas: reservation.refundableOctas,
      deadlineAt: reservation.deadlineAt.toISOString(),
    })),
  });
}
