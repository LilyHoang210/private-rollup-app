import type { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import type {
  VaultUploadQuote,
  VaultUploadReservation,
} from "@/server/vault/payment-vault-types";

export interface PaymentVaultClientConfig {
  contractAddress: `0x${string}`;
  network: "shelbynet" | "testnet";
}

export interface BuildUploadPaymentPayloadInput {
  requestId: string;
  quote: VaultUploadQuote;
  userAddress: `0x${string}`;
  blobOrPackNameHash: string;
  commitmentRoot: string;
  deadlineAt: string;
}

export class PaymentVaultClient {
  constructor(private readonly config: PaymentVaultClientConfig) {}

  buildUploadWithPaymentPayload(
    input: BuildUploadPaymentPayloadInput,
  ): InputTransactionData {
    return {
      data: {
        function: `${this.config.contractAddress}::payment_vault::upload_with_payment`,
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

  buildWithdrawRefundPayload(amountOctas: number): InputTransactionData {
    return {
      data: {
        function: `${this.config.contractAddress}::payment_vault::withdraw_refund`,
        functionArguments: [amountOctas],
      },
    };
  }

  async getReservation(
    requestId: string,
  ): Promise<VaultUploadReservation | undefined> {
    void requestId;
    return undefined;
  }
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
