export interface AptosWalletAccount {
  address: string;
  publicKey: string;
}

export interface AptosWalletProvider {
  connect?: () => Promise<unknown>;
  account?: () => Promise<unknown>;
  signMessage?: (payload: {
    message: string;
    nonce: string;
    address: boolean;
    application: boolean;
    chainId: boolean;
  }) => Promise<unknown>;
}

export interface DetectedAptosWallet {
  id: string;
  name: string;
  provider: AptosWalletProvider;
}

declare global {
  interface Window {
    aptos?: AptosWalletProvider;
    martian?: AptosWalletProvider;
    pontem?: AptosWalletProvider;
    fewcha?: AptosWalletProvider;
    rise?: AptosWalletProvider;
  }
}

type WalletSource = Record<string, unknown>;

const WALLET_GLOBALS = [
  { id: "petra", name: "Petra", key: "aptos" },
  { id: "martian", name: "Martian", key: "martian" },
  { id: "pontem", name: "Pontem", key: "pontem" },
  { id: "fewcha", name: "Fewcha", key: "fewcha" },
  { id: "rise", name: "Rise", key: "rise" },
] as const;

export function detectAptosWallets(source?: WalletSource): DetectedAptosWallet[] {
  const walletSource =
    source ?? (typeof window === "undefined" ? undefined : (window as unknown as WalletSource));

  if (!walletSource) {
    return [];
  }

  return WALLET_GLOBALS.flatMap((wallet) => {
    const provider = walletSource[wallet.key];

    if (!isAptosWalletProvider(provider)) {
      return [];
    }

    return [{ id: wallet.id, name: wallet.name, provider }];
  });
}

export async function connectAptosWallet(
  provider: AptosWalletProvider,
): Promise<AptosWalletAccount> {
  if (typeof provider.connect !== "function") {
    throw new Error("Selected wallet does not expose a connect method.");
  }

  const connectResult = await provider.connect();
  const account = extractAccount(connectResult) ?? (await accountFromProvider(provider));

  if (!account) {
    throw new Error("Selected wallet did not return an account address and public key.");
  }

  return account;
}

export async function signAuthChallenge(
  provider: AptosWalletProvider,
  message: string,
): Promise<{ signature: string; fullMessage?: string }> {
  if (typeof provider.signMessage !== "function") {
    throw new Error("Selected wallet does not expose message signing.");
  }

  const result = await provider.signMessage({
    message,
    nonce: extractChallengeNonce(message),
    address: true,
    application: true,
    chainId: true,
  });

  const signature = extractStringProperty(result, "signature") ?? asString(result);
  const fullMessage = extractStringProperty(result, "fullMessage");

  if (!signature) {
    throw new Error("Selected wallet did not return a signature.");
  }

  return { signature, fullMessage };
}

function isAptosWalletProvider(value: unknown): value is AptosWalletProvider {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as AptosWalletProvider;
  return (
    typeof candidate.connect === "function" ||
    typeof candidate.account === "function" ||
    typeof candidate.signMessage === "function"
  );
}

async function accountFromProvider(
  provider: AptosWalletProvider,
): Promise<AptosWalletAccount | undefined> {
  if (typeof provider.account !== "function") {
    return undefined;
  }

  return extractAccount(await provider.account());
}

function extractAccount(value: unknown): AptosWalletAccount | undefined {
  const direct = extractAccountFields(value);
  if (direct) {
    return direct;
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const nested = (value as { account?: unknown }).account;
  return extractAccountFields(nested);
}

function extractAccountFields(value: unknown): AptosWalletAccount | undefined {
  const address = extractStringProperty(value, "address");
  const publicKey = extractStringProperty(value, "publicKey");

  if (!address || !publicKey) {
    return undefined;
  }

  return { address, publicKey };
}

function extractStringProperty(value: unknown, property: string) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return asString((value as Record<string, unknown>)[property]);
}

function asString(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && "toString" in value) {
    const text = String(value);
    return text === "[object Object]" ? undefined : text;
  }

  return undefined;
}

function extractChallengeNonce(message: string) {
  return message.match(/^Nonce:\s*(.+)$/m)?.[1]?.trim() ?? "";
}
