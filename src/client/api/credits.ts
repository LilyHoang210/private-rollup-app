import { formatCredits as formatDomainCredits } from "@/domain/credits";

export type CreditLedgerEntryType =
  | "testnet_grant"
  | "upload_reserve"
  | "pack_settlement";

export interface CreditLedgerEntryResponse {
  id: string;
  type: CreditLedgerEntryType;
  amountMicrocredits: number;
  reservedDeltaMicrocredits: number;
  uploadId?: string;
  packId?: string;
  createdAt: string;
}

export interface CreditAccountResponse {
  userId: string;
  balanceMicrocredits: number;
  reservedMicrocredits: number;
  availableMicrocredits: number;
  ledger: CreditLedgerEntryResponse[];
}

type Fetcher = typeof fetch;

export async function getCreditAccount(
  fetcher: Fetcher = fetch,
): Promise<{ account: CreditAccountResponse }> {
  const response = await fetcher("/api/credits");

  if (!response.ok) {
    throw new Error(`Credit account request failed: ${response.status}`);
  }

  return (await response.json()) as { account: CreditAccountResponse };
}

export function formatCredits(microcredits: number) {
  return formatDomainCredits(microcredits);
}
