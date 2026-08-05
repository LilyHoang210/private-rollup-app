import type {
  AptosSignAndSubmitTransactionOutput,
  InputTransactionData,
} from "@aptos-labs/wallet-adapter-react";
import type { AptAccountResponse } from "@/client/api/apt-account";

const WALLET_RESPONSE_TIMEOUT_MS = 45_000;
const DEPOSIT_SYNC_ATTEMPTS = 6;
const DEPOSIT_SYNC_INTERVAL_MS = process.env.NODE_ENV === "test" ? 10 : 1200;

export function buildDepositTransaction(input: {
  recipientAddress: string;
  amountOctas: number;
}): InputTransactionData {
  return {
    data: {
      function: "0x1::aptos_account::transfer",
      functionArguments: [input.recipientAddress, input.amountOctas],
    },
  };
}

export async function depositToServiceWallet(input: {
  amountOctas: number;
  recipientAddress: string;
  previousBalanceOctas: number;
  signAndSubmitTransaction: (
    transaction: InputTransactionData,
  ) => Promise<AptosSignAndSubmitTransactionOutput>;
  syncDeposits: () => Promise<{ account: AptAccountResponse }>;
  onSubmitted?: (transactionHash: string) => void;
  waitMs?: number;
}) {
  const submitted = await withWalletResponseTimeout(
    input.signAndSubmitTransaction(
      buildDepositTransaction({
        recipientAddress: input.recipientAddress,
        amountOctas: input.amountOctas,
      }),
    ),
  );
  input.onSubmitted?.(submitted.hash);
  const account = await waitForServiceWalletDeposit({
    previousBalanceOctas: input.previousBalanceOctas,
    syncDeposits: input.syncDeposits,
    waitMs: input.waitMs ?? DEPOSIT_SYNC_INTERVAL_MS,
  });

  return { account, transactionHash: submitted.hash };
}

export async function withWalletResponseTimeout(
  promise: Promise<AptosSignAndSubmitTransactionOutput>,
  timeoutMs = WALLET_RESPONSE_TIMEOUT_MS,
) {
  let timeoutId: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(
            new Error(
              "Wallet did not return a transaction hash. If you approved the transfer, wait a few seconds and refresh the service wallet balance.",
            ),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

async function waitForServiceWalletDeposit(input: {
  previousBalanceOctas: number;
  syncDeposits: () => Promise<{ account: AptAccountResponse }>;
  waitMs: number;
}) {
  let latest: AptAccountResponse | undefined;
  for (let attempt = 0; attempt < DEPOSIT_SYNC_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, input.waitMs));
    }
    const result = await input.syncDeposits();
    latest = result.account;
    if (latest.balanceOctas > input.previousBalanceOctas) return latest;
  }
  if (!latest) throw new Error("Deposit was submitted but balance sync is unavailable");
  throw new Error(
    "The transaction was submitted, but the service wallet balance did not increase yet. It may still be indexing; refresh the service wallet balance in a few seconds.",
  );
}
