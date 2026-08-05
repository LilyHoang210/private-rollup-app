import { Aptos, AptosConfig } from "@aptos-labs/ts-sdk";
import { SHELBY_APTOS_NETWORK } from "@/config/shelbynet";

const OCTAS_PER_APT = BigInt(100_000_000);
const APT_DECIMALS = 8;
const aptos = new Aptos(new AptosConfig({ network: SHELBY_APTOS_NETWORK }));

export async function getAptBalance(address: string) {
  const octas = await aptos.getAccountAPTAmount({ accountAddress: address });

  return `${formatAptAmount(octas)} APT`;
}

export function formatAptAmount(octas: number | bigint) {
  const amount = typeof octas === "bigint" ? octas : BigInt(Math.trunc(octas));
  const whole = amount / OCTAS_PER_APT;
  const fraction = (amount % OCTAS_PER_APT)
    .toString()
    .padStart(APT_DECIMALS, "0")
    .replace(/0+$/, "");

  return fraction ? `${whole}.${fraction}` : whole.toString();
}
