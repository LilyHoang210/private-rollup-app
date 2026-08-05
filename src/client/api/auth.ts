export interface WalletChallengeInput {
  walletAddress: string;
  domain: string;
  uri: string;
  chainId: "aptos-shelbynet";
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
  authenticated?: boolean;
  chainId: string;
  walletAddress?: string;
  walletAddressHash?: string;
  expiresAt?: string;
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

export async function getWalletSession(
  fetcher: Fetcher = fetch,
): Promise<AuthSessionResponse | { authenticated: false }> {
  const response = await fetcher("/api/auth/session");

  if (!response.ok) {
    throw new Error(`Session request failed: ${response.status}`);
  }

  return (await response.json()) as AuthSessionResponse | { authenticated: false };
}
