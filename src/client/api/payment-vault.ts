import type { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import type { VaultUploadQuote } from "@/server/vault/payment-vault-types";

export async function getVaultUploadQuote(input: {
  encryptedSizeBytes: number;
  retentionDays: "30" | "90" | "365";
  mode: "shared_pack" | "dedicated_blob";
}): Promise<{
  quote: VaultUploadQuote;
  payment: {
    payer: "connected_wallet";
    receiver: "payment_vault_contract";
    contractAddress: `0x${string}`;
  };
}> {
  const response = await fetch("/api/payment-vault/quote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("Payment Vault quote failed");
  return response.json();
}

export function buildUploadWithPaymentPayload(input: {
  contractAddress: `0x${string}`;
  requestId: string;
  quote: VaultUploadQuote;
  blobOrPackNameHash: string;
  commitmentRoot: string;
  deadlineAt: string;
}): InputTransactionData {
  return {
    data: {
      function: `${input.contractAddress}::payment_vault::upload_with_payment`,
      functionArguments: [
        new TextEncoder().encode(input.requestId),
        input.quote.encryptedSizeBytes,
        Number(input.quote.retentionDays),
        input.quote.mode === "shared_pack" ? 0 : 1,
        hexToBytes(input.blobOrPackNameHash),
        hexToBytes(input.commitmentRoot),
        input.quote.estimatedShelbyFeeOctas,
        input.quote.estimatedStorageFeeOctas,
        input.quote.platformFeeOctas,
        input.quote.safetyBufferOctas,
        Math.floor(new Date(input.deadlineAt).getTime() / 1000),
      ],
    },
  };
}

function hexToBytes(hex: string) {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!/^[a-fA-F0-9]*$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error("Hex value is invalid");
  }
  return Uint8Array.from(
    clean.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [],
  );
}
