import type { FileCategory, RetentionCohort } from "@/domain/files";
import type { UploadStatus } from "@/domain/uploads";

export interface UploadApiItemInput {
  localId: string;
  label: string;
  category: FileCategory;
  mimeType?: string;
  plaintextSizeBytes: number;
  ciphertextSizeBytes: number;
  ciphertextSha256: string;
  encryptedManifest: string;
  wrappedDek: string;
}

export interface UploadApiItemResponse extends UploadApiItemInput {
  id: string;
  status: UploadStatus;
  packStrategy: "shared_pack" | "dedicated_blob";
  stagingRef?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UploadBillingResponse {
  reserveMicrocredits: number;
  settledMicrocredits?: number;
  creditStatus: "reserved" | "settled" | "payment_required";
}

export interface UploadApiBatchResponse {
  id: string;
  status: UploadStatus;
  retentionDays: RetentionCohort;
  totalCiphertextSizeBytes: number;
  billing?: UploadBillingResponse;
  storage?: {
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
  };
  items: UploadApiItemResponse[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UploadEncryptedPackRequest extends CreateUploadBatchRequest {
  packBytesBase64: string;
  packSha256: string;
}

export interface CreateUploadBatchRequest {
  idempotencyKey: string;
  retentionDays: RetentionCohort;
  items: UploadApiItemInput[];
}

export interface CompleteUploadBatchRequest {
  items: Array<{
    localId: string;
    ciphertextSha256: string;
    stagingRef: string;
  }>;
}

type Fetcher = typeof fetch;

export async function createUploadBatch(
  input: CreateUploadBatchRequest,
  fetcher: Fetcher = fetch,
): Promise<UploadApiBatchResponse> {
  return postJson(fetcher, "/api/uploads", input);
}

export async function completeUploadBatch(
  batchId: string,
  input: CompleteUploadBatchRequest,
  fetcher: Fetcher = fetch,
): Promise<UploadApiBatchResponse> {
  return postJson(fetcher, `/api/uploads/${batchId}/complete`, input);
}

export async function uploadEncryptedPack(
  input: UploadEncryptedPackRequest,
  fetcher: Fetcher = fetch,
): Promise<UploadApiBatchResponse> {
  return postJson(fetcher, "/api/storage/upload", input);
}

export async function listUploadBatches(
  fetcher: Fetcher = fetch,
): Promise<{ batches: UploadApiBatchResponse[] }> {
  const response = await fetcher("/api/uploads");

  if (!response.ok) {
    throw new Error(`Upload list request failed: ${response.status}`);
  }

  return (await response.json()) as { batches: UploadApiBatchResponse[] };
}

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
    const errorBody = await response.json().catch(() => undefined) as
      | { message?: string }
      | undefined;
    throw new Error(errorBody?.message || `Upload request failed: ${response.status}`);
  }

  return (await response.json()) as TResponse;
}
