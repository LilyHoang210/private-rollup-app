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
}

export interface UploadApiBatchResponse {
  id: string;
  status: UploadStatus;
  retentionDays: RetentionCohort;
  totalCiphertextSizeBytes: number;
  items: UploadApiItemResponse[];
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
    throw new Error(`Upload request failed: ${response.status}`);
  }

  return (await response.json()) as TResponse;
}
