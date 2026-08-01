import {
  Account,
  Aptos,
  AptosConfig,
  Ed25519PrivateKey,
  Network,
} from "@aptos-labs/ts-sdk";

const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

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

export async function getTestnetAptBalance(address: string) {
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
