import { createHash } from "node:crypto";
import {
  Account,
  Ed25519PrivateKey,
  Network,
  type AccountAddressInput,
} from "@aptos-labs/ts-sdk";
import { ShelbyNodeClient, type BlobName } from "@shelby-protocol/sdk/node";
import type { RetentionCohort } from "@/domain/files";

export interface ShelbyWriterConfig {
  network: "shelbynet";
  privateKey: string;
  location: string;
  apiKey?: string;
  rpcBaseUrl?: string;
}

export interface EncryptedPackWriteInput {
  batchId: string;
  bytes: Uint8Array;
  sha256: string;
  retentionDays: RetentionCohort;
}

export interface ShelbyWriteReceipt {
  driver: "shelby";
  network: "shelbynet";
  verified: true;
  ownerAddress: string;
  blobId: string;
  blobName: string;
  blobSizeBytes: number;
  ciphertextSha256: string;
  transactionHash?: string;
  expiresAt: string;
  downloadUrl: string;
}

interface ShelbyClientPort {
  upload(input: {
    signer: Account;
    blobData: Uint8Array;
    blobName: BlobName;
    expirationMicros: number;
    options: { selectedLocation: string };
  }): Promise<void>;
  coordination: {
    getFullObjectMetadata(input: {
      account: AccountAddressInput;
      name: BlobName;
    }): Promise<
      | {
          uid?: bigint;
          size: number;
          isWritten: boolean;
          expirationMicros: number;
        }
      | undefined
    >;
    getBlobActivities(input: unknown): Promise<
      Array<{
        blobName: string;
        type: string;
        transactionHash: string;
      }>
    >;
  };
  aptos?: {
    getAccountTransactions(input: unknown): Promise<
      Array<{
        hash: string;
        success: boolean;
        payload?: { function?: string; arguments?: unknown[] };
      }>
    >;
  };
}

interface ShelbyWriterDependencies {
  config?: ShelbyWriterConfig;
  now?: () => Date;
  createSigner?: (privateKey: string) => Account;
  createClient?: (config: ShelbyWriterConfig) => ShelbyClientPort;
}

export async function writeEncryptedPack(
  input: EncryptedPackWriteInput,
  dependencies: ShelbyWriterDependencies = {},
): Promise<ShelbyWriteReceipt> {
  const actualHash = createHash("sha256").update(input.bytes).digest("hex");
  if (actualHash !== input.sha256.toLowerCase()) {
    throw new Error("Ciphertext pack checksum mismatch");
  }

  const config = dependencies.config ?? readShelbyWriterConfig();
  const signer = (dependencies.createSigner ?? createServiceSigner)(config.privateKey);
  const client = (dependencies.createClient ?? createShelbyClient)(config);
  const now = dependencies.now?.() ?? new Date();
  const expirationMicros =
    now.getTime() * 1_000 + input.retentionDays * 86_400_000_000;
  const blobName = `private-rollup/${safeBatchId(input.batchId)}.prp` as BlobName;

  await client.upload({
    signer,
    blobData: input.bytes,
    blobName,
    expirationMicros,
    options: { selectedLocation: config.location },
  });

  const metadata = await client.coordination.getFullObjectMetadata({
    account: signer.accountAddress,
    name: blobName,
  });
  if (!metadata?.isWritten || metadata.size !== input.bytes.byteLength) {
    throw new Error("Shelby upload finished but on-chain verification failed");
  }

  const transactionHash = await findUploadTransactionHash(
    client,
    signer.accountAddress.toString(),
    blobName,
  );
  const ownerAddress = signer.accountAddress.toString();

  return {
    driver: "shelby",
    network: "shelbynet",
    verified: true,
    ownerAddress,
    blobId: metadata.uid?.toString() ?? `${ownerAddress}/${blobName}`,
    blobName,
    blobSizeBytes: metadata.size,
    ciphertextSha256: actualHash,
    transactionHash,
    expiresAt: new Date(metadata.expirationMicros / 1_000).toISOString(),
    downloadUrl: buildDownloadUrl(config.rpcBaseUrl, ownerAddress, blobName),
  };
}

export function readShelbyWriterConfig(
  env: NodeJS.ProcessEnv = process.env,
): ShelbyWriterConfig {
  const privateKey = env.SHELBY_ACCOUNT_PRIVATE_KEY?.trim();
  const location = env.SHELBY_LOCATION?.trim();
  if (!privateKey || !location || env.SHELBY_DRIVER !== "shelby") {
    throw new Error("Shelby storage writer is not configured");
  }

  return {
    network: "shelbynet",
    privateKey,
    location,
    apiKey: env.SHELBY_API_KEY?.trim() || undefined,
    rpcBaseUrl: env.SHELBY_API_URL?.trim() || undefined,
  };
}

function createServiceSigner(privateKey: string) {
  return Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(privateKey),
  });
}

function createShelbyClient(config: ShelbyWriterConfig): ShelbyClientPort {
  return new ShelbyNodeClient({
    network: Network.SHELBYNET,
    apiKey: config.apiKey,
    rpc: config.rpcBaseUrl ? { baseUrl: config.rpcBaseUrl } : undefined,
    locationHint: config.location,
  }) as ShelbyClientPort;
}

async function findUploadTransactionHash(
  client: ShelbyClientPort,
  ownerAddress: string,
  blobName: string,
) {
  try {
    const activities = await client.coordination.getBlobActivities({
      where: {
        account_address: { _eq: ownerAddress },
        blob_name: { _eq: blobName },
      },
      pagination: { limit: 20 },
    });
    const indexedHash = activities.find(
      (activity) =>
        activity.blobName === blobName &&
        (activity.type === "commit_object" || activity.type === "write_blob"),
    )?.transactionHash;
    if (indexedHash) return indexedHash;
  } catch {
    // The indexer can lag the on-chain view immediately after a write.
  }

  try {
    const transactions = await client.aptos?.getAccountTransactions({
      accountAddress: ownerAddress,
      options: { limit: 20 },
    });
    return transactions
      ?.reverse()
      .find(
        (transaction) =>
          transaction.success &&
          transaction.payload?.function?.endsWith("::blob_metadata::register_blob") &&
          transaction.payload.arguments?.some((argument) => argument === blobName),
      )?.hash;
  } catch {
    return undefined;
  }
}

function safeBatchId(batchId: string) {
  const safe = batchId.trim().replace(/[^a-zA-Z0-9_-]/g, "-");
  if (!safe) {
    throw new Error("Batch ID is required");
  }
  return safe;
}

function buildDownloadUrl(
  rpcBaseUrl: string | undefined,
  ownerAddress: string,
  blobName: string,
) {
  const base = (rpcBaseUrl || "https://api.shelbynet.shelby.xyz/shelby").replace(
    /\/$/,
    "",
  );
  const encodedName = blobName.split("/").map(encodeURIComponent).join("/");
  return `${base}/v1/blobs/${encodeURIComponent(ownerAddress)}/${encodedName}`;
}
