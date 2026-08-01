export interface WalletChallengeInput {
  walletAddress: string;
  domain: string;
  uri: string;
  chainId: "aptos-testnet";
}

export interface WalletVerifyInput {
  challengeId: string;
  walletAddress: string;
  publicKey: string;
  domain: string;
  signature: string;
  fullMessage?: string;
}

export interface WalletChallengeResponse {
  id: string;
  message: string;
  expiresAt: string;
}

export interface AuthSessionResponse {
  chainId: string;
  walletAddressHash?: string;
}

type Fetcher = typeof fetch;

async function postJson<TResponse>(
  fetcher: Fetcher,
  url: string,
  body: unknown,
): Promise<TResponse> {
  const response = await fetcher(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as TResponse;
}

export async function createWalletChallenge(
  input: WalletChallengeInput,
  fetcher: Fetcher = fetch,
): Promise<WalletChallengeResponse> {
  return postJson<WalletChallengeResponse>(
    fetcher,
    "/api/auth/challenge",
    input,
  );
}

export async function verifyWalletChallenge(
  input: WalletVerifyInput,
  fetcher: Fetcher = fetch,
): Promise<AuthSessionResponse> {
  return postJson<AuthSessionResponse>(
    fetcher,
    "/api/auth/verify",
    input,
  );
}
