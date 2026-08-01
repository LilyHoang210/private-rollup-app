import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUserId } from "@/server/auth/request-session";
import { createVaultPublicKeyRecord } from "@/server/vault/service";

const vaultRequestSchema = z
  .object({
    publicKeyBytes: z.string().min(1),
    algorithm: z.literal("DHKEM_X25519_HKDF_SHA256"),
  })
  .strict();

export async function POST(request: Request) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const body = vaultRequestSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "INVALID_VAULT_PUBLIC_KEY" }, { status: 400 });
  }

  const record = createVaultPublicKeyRecord({
    userId,
    ...body.data,
  });

  return NextResponse.json({
    id: record.id,
    algorithm: record.algorithm,
    ownerFingerprint: record.ownerFingerprint,
    createdAt: record.createdAt,
  });
}
