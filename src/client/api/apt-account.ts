import { formatApt as formatDomainApt } from "@/domain/apt";

export type AptLedgerEntryType =
  | "wallet_deposit"
  | "upload_reserve"
  | "upload_release"
  | "pack_settlement"
  | "withdrawal";

export interface AptLedgerEntryResponse {
  id: string;
  type: AptLedgerEntryType;
  amountOctas: number;
  reservedDeltaOctas: number;
  uploadId?: string;
  packId?: string;
  createdAt: string;
}

export interface AptAccountResponse {
  userId: string;
  balanceOctas: number;
  reservedOctas: number;
  availableOctas: number;
  wallet: {
    address: string;
    network: "shelbynet";
    onChainBalanceOctas: number;
    lastSyncedAt?: string;
  };
  ledger: AptLedgerEntryResponse[];
}

type Fetcher = typeof fetch;

export async function getAptAccount(
  fetcher: Fetcher = fetch,
): Promise<{ account: AptAccountResponse }> {
  const response = await fetcher("/api/apt-account");

  if (!response.ok) {
    throw new Error(`APT account request failed: ${response.status}`);
  }

  return (await response.json()) as { account: AptAccountResponse };
}

export function formatApt(octas: number) {
  return formatDomainApt(octas);
}

export async function syncAptDeposits(fetcher: Fetcher = fetch) {
  return postAptAccount("/api/apt-account/sync", {}, fetcher);
}

export async function withdrawAvailableApt(
  input: { amountOctas: number; idempotencyKey: string },
  fetcher: Fetcher = fetch,
) {
  return postAptAccount("/api/apt-account/withdraw", input, fetcher) as Promise<{
    account: AptAccountResponse;
    transactionHash: string;
  }>;
}

async function postAptAccount(url: string, body: unknown, fetcher: Fetcher) {
  const response = await fetcher(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => undefined)) as
    | { account?: AptAccountResponse; message?: string; transactionHash?: string }
    | undefined;
  if (!response.ok) {
    throw new Error(data?.message || `APT account request failed: ${response.status}`);
  }
  return data as { account: AptAccountResponse; transactionHash?: string };
}
