import {
  Account,
  Aptos,
  AptosConfig,
  Ed25519PrivateKey,
} from "@aptos-labs/ts-sdk";
import { SHELBY_APTOS_NETWORK } from "@/config/shelbynet";

const aptos = new Aptos(new AptosConfig({ network: SHELBY_APTOS_NETWORK }));
const WITHDRAWAL_MAX_GAS_AMOUNT = 6_000;
const WITHDRAWAL_GAS_UNIT_PRICE = 100;

type AptosWithdrawalClient = Pick<
  Aptos,
  "signAndSubmitTransaction" | "waitForTransaction"
> & {
  transaction: {
    build: {
      simple: Aptos["transaction"]["build"]["simple"];
    };
  };
};

export function generateCustodialWallet() {
  const account = Account.generate();
  return {
    address: account.accountAddress.toString(),
    privateKey: account.privateKey.toString(),
  };
}

export function addressFromPrivateKey(privateKey: string) {
  return accountFromPrivateKey(privateKey).accountAddress.toString();
}

export async function getShelbynetAptBalance(address: string) {
  return aptos.getAccountAPTAmount({ accountAddress: address });
}

export async function sponsoredAptWithdrawal(input: {
  custodialPrivateKey: string;
  destination: string;
  amountOctas: number;
  feePayerPrivateKey?: string;
}) {
  const sender = accountFromPrivateKey(input.custodialPrivateKey);
  const feePayer = accountFromPrivateKey(
    input.feePayerPrivateKey ?? requireFeePayerPrivateKey(),
  );
  const transaction = await aptos.transaction.build.simple({
    sender: sender.accountAddress,
    withFeePayer: true,
    data: {
      function: "0x1::aptos_account::transfer",
      functionArguments: [input.destination, input.amountOctas],
    },
  });
  const pending = await aptos.signAndSubmitTransaction({
    signer: sender,
    feePayer,
    transaction,
  });
  const result = await aptos.waitForTransaction({
    transactionHash: pending.hash,
    options: { checkSuccess: true },
  });
  return { transactionHash: pending.hash, success: result.success };
}

export async function submitCustodialAptWithdrawal(
  input: {
    custodialPrivateKey: string;
    destination: string;
    amountOctas: number;
  },
  dependencies: {
    aptosClient?: AptosWithdrawalClient;
    accountFromPrivateKey?: (privateKey: string) => Account;
  } = {},
) {
  const aptosClient = dependencies.aptosClient ?? aptos;
  const sender = (dependencies.accountFromPrivateKey ?? accountFromPrivateKey)(
    input.custodialPrivateKey,
  );
  const transaction = await aptosClient.transaction.build.simple({
    sender: sender.accountAddress,
    data: {
      function: "0x1::aptos_account::transfer",
      functionArguments: [input.destination, input.amountOctas],
    },
    options: {
      gasUnitPrice: WITHDRAWAL_GAS_UNIT_PRICE,
      maxGasAmount: WITHDRAWAL_MAX_GAS_AMOUNT,
    },
  });
  const pending = await aptosClient.signAndSubmitTransaction({
    signer: sender,
    transaction,
  });
  const result = await aptosClient.waitForTransaction({
    transactionHash: pending.hash,
    options: { checkSuccess: true },
  });
  return {
    transactionHash: pending.hash,
    success: result.success,
    gasFeeOctas: transactionGasFeeOctas(result),
  };
}

export function getFeePayerAddress(privateKey = requireFeePayerPrivateKey()) {
  return accountFromPrivateKey(privateKey).accountAddress.toString();
}

function accountFromPrivateKey(privateKey: string) {
  return Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(privateKey),
  });
}

function requireFeePayerPrivateKey() {
  const value = process.env.APTOS_FEE_PAYER_PRIVATE_KEY?.trim();
  if (!value) {
    throw new Error("APTOS_FEE_PAYER_PRIVATE_KEY is required for withdrawals");
  }
  return value;
}

function transactionGasFeeOctas(result: { gas_used?: string; gas_unit_price?: string }) {
  const gasUsed = BigInt(result.gas_used ?? "0");
  const gasUnitPrice = BigInt(result.gas_unit_price ?? "0");
  const gasFee = gasUsed * gasUnitPrice;
  if (gasFee > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Withdrawal gas fee exceeds safe accounting range");
  }
  return Number(gasFee);
}
