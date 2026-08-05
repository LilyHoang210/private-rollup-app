export interface ShelbyDirectPaymentCapabilities {
  supported: boolean;
  network: "shelbynet" | "testnet";
  paymentModuleAddress?: `0x${string}`;
  registerFunction?: string;
  payFunction?: string;
  storageCoinType?: string;
  aptRequired: boolean;
  reason?: string;
}

const MISSING_DIRECT_PAYMENT_CONFIG_REASON =
  "Shelby direct contract payment requires SHELBY_DIRECT_PAYMENT_MODULE_ADDRESS, SHELBY_DIRECT_REGISTER_FUNCTION, SHELBY_DIRECT_PAY_FUNCTION, and SHELBY_STORAGE_COIN_TYPE.";

export function readShelbyDirectPaymentCapabilities(
  env: NodeJS.ProcessEnv = process.env,
): ShelbyDirectPaymentCapabilities {
  const network = parseShelbyNetwork(env.SHELBY_NETWORK);
  const paymentModuleAddress = parseHexAddress(
    env.SHELBY_DIRECT_PAYMENT_MODULE_ADDRESS,
  );
  const registerFunction = parseFunctionId(env.SHELBY_DIRECT_REGISTER_FUNCTION);
  const payFunction = parseFunctionId(env.SHELBY_DIRECT_PAY_FUNCTION);
  const storageCoinType = parseFunctionId(env.SHELBY_STORAGE_COIN_TYPE);

  if (
    !paymentModuleAddress ||
    !registerFunction ||
    !payFunction ||
    !storageCoinType
  ) {
    return {
      supported: false,
      network,
      aptRequired: true,
      reason: MISSING_DIRECT_PAYMENT_CONFIG_REASON,
    };
  }

  return {
    supported: true,
    network,
    paymentModuleAddress,
    registerFunction,
    payFunction,
    storageCoinType,
    aptRequired: true,
  };
}

export function requireShelbyDirectPaymentCapabilities(
  env: NodeJS.ProcessEnv = process.env,
): ShelbyDirectPaymentCapabilities {
  const capabilities = readShelbyDirectPaymentCapabilities(env);
  if (!capabilities.supported) {
    throw new Error(
      `Shelby direct contract payment is not configured for this environment. ${capabilities.reason}`,
    );
  }
  return capabilities;
}

function parseShelbyNetwork(value: string | undefined): "shelbynet" | "testnet" {
  return value === "testnet" ? "testnet" : "shelbynet";
}

function parseHexAddress(value: string | undefined): `0x${string}` | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !/^0x[a-fA-F0-9]+$/.test(trimmed)) return undefined;
  return trimmed as `0x${string}`;
}

function parseFunctionId(value: string | undefined) {
  const trimmed = value?.trim();
  if (
    !trimmed ||
    !/^0x[a-fA-F0-9]+::[A-Za-z_][A-Za-z0-9_]*::[A-Za-z_][A-Za-z0-9_]*$/.test(
      trimmed,
    )
  ) {
    return undefined;
  }
  return trimmed;
}
