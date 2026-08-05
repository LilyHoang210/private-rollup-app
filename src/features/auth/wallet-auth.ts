import {
  createWalletChallenge,
  verifyWalletChallenge,
} from "@/client/api/auth";
import { SHELBY_AUTH_CHAIN_ID } from "@/config/shelbynet";

export async function authenticateConnectedWallet({
  account,
  signMessage,
}: {
  account: {
    address: { toString: () => string };
    publicKey?: { toString: () => string } | null;
  };
  signMessage: (message: {
    address: boolean;
    application: boolean;
    chainId: boolean;
    message: string;
    nonce: string;
  }) => Promise<{ signature: unknown; fullMessage?: string }>;
}) {
  const walletAddress = account.address.toString();
  const publicKey = account.publicKey?.toString();

  if (!publicKey) {
    throw new Error("The connected wallet did not expose a public key.");
  }

  const challenge = await createWalletChallenge({
    walletAddress,
    domain: window.location.hostname,
    uri: window.location.origin,
    chainId: SHELBY_AUTH_CHAIN_ID,
  });
  const signedChallenge = await signMessage({
    address: true,
    application: true,
    chainId: true,
    message: challenge.message,
    nonce: extractChallengeNonce(challenge.message),
  });
  const result = await verifyWalletChallenge({
    challengeId: challenge.id,
    walletAddress,
    publicKey,
    domain: window.location.hostname,
    signature: String(signedChallenge.signature),
    fullMessage: signedChallenge.fullMessage,
  });

  return { chainId: result.chainId, walletAddress };
}

export function shortAddress(address: string) {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function walletDetectionMessage(wallets: ReadonlyArray<{ name: string }>) {
  if (wallets.length > 0) {
    return "Click Connect wallet to choose an installed Aptos wallet extension.";
  }

  return "Install a supported wallet extension to continue.";
}

export function isExtensionWallet(wallet: { name: string }) {
  return !wallet.name.toLowerCase().startsWith("continue with ");
}

export function slugWalletName(walletName: string) {
  return walletName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function extractChallengeNonce(message: string) {
  return message.match(/^Nonce:\s*(.+)$/m)?.[1]?.trim() ?? "";
}
