export interface DemoWalletConnectInput {
  walletAddress: string;
  domain: string;
  uri: string;
  chainId: "aptos-testnet";
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

export async function connectDemoWallet(
  input: DemoWalletConnectInput,
  fetcher: Fetcher = fetch,
): Promise<AuthSessionResponse> {
  const challenge = await postJson<{ id: string; message: string }>(
    fetcher,
    "/api/auth/challenge",
    input,
  );

  return postJson<AuthSessionResponse>(fetcher, "/api/auth/verify", {
    challengeId: challenge.id,
    walletAddress: input.walletAddress,
    domain: input.domain,
    signature: `signed:${challenge.message}`,
  });
}
