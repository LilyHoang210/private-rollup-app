import { NextResponse } from "next/server";
import { z } from "zod";
import { createVaultPublicKeyRecord } from "@/server/vault/service";

const vaultRequestSchema = z
  .object({
    publicKeyBytes: z.string().min(1),
    algorithm: z.literal("DHKEM_X25519_HKDF_SHA256"),
  })
  .strict();

export async function POST(request: Request) {
  const body = vaultRequestSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "INVALID_VAULT_PUBLIC_KEY" }, { status: 400 });
  }

  const record = createVaultPublicKeyRecord({
    userId: "demo-user",
    ...body.data,
  });

  return NextResponse.json({
    id: record.id,
    algorithm: record.algorithm,
    ownerFingerprint: record.ownerFingerprint,
    createdAt: record.createdAt,
  });
}
