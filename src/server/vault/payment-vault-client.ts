import type { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import {
  Account,
  Aptos,
  AptosConfig,
  Ed25519PrivateKey,
} from "@aptos-labs/ts-sdk";
import { SHELBY_APTOS_NETWORK } from "@/config/shelbynet";
import type {
  VaultUploadQuote,
  VaultUploadReservation,
} from "@/server/vault/payment-vault-types";

export interface PaymentVaultClientConfig {
  contractAddress: `0x${string}`;
  network: "shelbynet" | "testnet";
  operatorPrivateKey?: string;
}

export interface BuildUploadPaymentPayloadInput {
  requestId: string;
  quote: VaultUploadQuote;
  userAddress: `0x${string}`;
  blobOrPackNameHash: string;
  commitmentRoot: string;
  deadlineAt: string;
}

type AptosSettlementClient = Pick<
  Aptos,
  "signAndSubmitTransaction" | "waitForTransaction"
> & {
  transaction: {
    build: {
      simple: Aptos["transaction"]["build"]["simple"];
    };
  };
};

interface PaymentVaultClientDependencies {
  aptosClient?: AptosSettlementClient;
  accountFromPrivateKey?: (privateKey: string) => Account;
}

export class PaymentVaultClient {
  private readonly aptosClient: AptosSettlementClient;
  private readonly accountFromPrivateKey: (privateKey: string) => Account;

  constructor(
    private readonly config: PaymentVaultClientConfig,
    dependencies: PaymentVaultClientDependencies = {},
  ) {
    this.aptosClient =
      dependencies.aptosClient ??
      new Aptos(new AptosConfig({ network: SHELBY_APTOS_NETWORK }));
    this.accountFromPrivateKey =
      dependencies.accountFromPrivateKey ?? accountFromPrivateKey;
  }

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

  async markUploadSuccess(input: {
    requestId: string;
    actualShelbyCostOctas: number;
  }): Promise<{ transactionHash: string; success: boolean }> {
    if (!input.requestId.trim()) {
      throw new Error("Payment Vault request ID is required");
    }
    if (
      !Number.isSafeInteger(input.actualShelbyCostOctas) ||
      input.actualShelbyCostOctas < 0
    ) {
      throw new Error("Payment Vault actual Shelby cost is invalid");
    }

    const operator = this.accountFromPrivateKey(requireOperatorPrivateKey(this.config));
    const transaction = await this.aptosClient.transaction.build.simple({
      sender: operator.accountAddress,
      data: {
        function: `${this.config.contractAddress}::payment_vault::mark_upload_success`,
        functionArguments: [
          new TextEncoder().encode(input.requestId),
          input.actualShelbyCostOctas,
        ],
      },
    });
    const pending = await this.aptosClient.signAndSubmitTransaction({
      signer: operator,
      transaction,
    });
    const result = await this.aptosClient.waitForTransaction({
      transactionHash: pending.hash,
      options: { checkSuccess: true },
    });

    return { transactionHash: pending.hash, success: Boolean(result.success) };
  }
}

export function createConfiguredPaymentVaultSettlementClient(
  env: NodeJS.ProcessEnv = process.env,
) {
  const contractAddress = env.PAYMENT_VAULT_CONTRACT_ADDRESS?.trim();
  if (!contractAddress || !/^0x[a-fA-F0-9]+$/.test(contractAddress)) {
    throw new Error("PAYMENT_VAULT_CONTRACT_ADDRESS is required for settlement");
  }

  return new PaymentVaultClient({
    contractAddress: contractAddress as `0x${string}`,
    network: "shelbynet",
    operatorPrivateKey: env.PAYMENT_VAULT_OPERATOR_PRIVATE_KEY?.trim(),
  });
}

function accountFromPrivateKey(privateKey: string) {
  return Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(privateKey),
  });
}

function requireOperatorPrivateKey(config: PaymentVaultClientConfig) {
  const privateKey = config.operatorPrivateKey?.trim();
  if (!privateKey) {
    throw new Error("PAYMENT_VAULT_OPERATOR_PRIVATE_KEY is required for settlement");
  }
  return privateKey;
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
