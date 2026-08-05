import { NextResponse } from "next/server";
import { z } from "zod";
import { quoteVaultUpload } from "@/server/vault/payment-vault-quote";

const quoteSchema = z
  .object({
    encryptedSizeBytes: z.number().int().positive(),
    retentionDays: z.enum(["30", "90", "365"]),
    mode: z.enum(["shared_pack", "dedicated_blob"]),
  })
  .strict();

export async function POST(request: Request) {
  const body = quoteSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "VAULT_QUOTE_INVALID" }, { status: 400 });
  }

  const contractAddress =
    process.env.PAYMENT_VAULT_CONTRACT_ADDRESS?.trim() || "";

  return NextResponse.json({
    quote: quoteVaultUpload(body.data),
    payment: {
      payer: "connected_wallet",
      receiver: "payment_vault_contract",
      contractAddress,
    },
  });
}
