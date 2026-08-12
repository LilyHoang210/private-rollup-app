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
    throw new Error(await responseErrorMessage(response));
  }

  return (await response.json()) as TResponse;
}

async function responseErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as {
      error?: unknown;
      message?: unknown;
    };
    const serverMessage =
      typeof payload.error === "string" && payload.error.trim()
        ? payload.error
        : typeof payload.message === "string" && payload.message.trim()
          ? payload.message
          : undefined;

    if (serverMessage) {
      return serverMessage;
    }
  } catch {
    // Fall through to a status-based message when the server did not return JSON.
  }

  return `Request failed: ${response.status}`;
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
