import { hasDatabaseConfiguration } from "@/server/db/client";
import {
  completeDurableUploadBatch,
  createDurableUploadBatch,
  getDurableUploadBatch,
  listDurableUploadBatchesForPackPool,
  listDurableUploadBatchesForUser,
  type CompleteDurableUploadBatchInput,
} from "./durable-service";
import {
  completeUploadBatch,
  createUploadBatch,
  getUploadBatch,
  listUploadBatchesForPackPool,
  listUploadBatchesForUser,
  type CreateUploadBatchInput,
} from "./service";
import { getAptAccount } from "@/server/billing/apt-account-service";
import { getDurableAptAccount } from "@/server/billing/durable-apt-service";

export async function createUploadBatchRuntime(input: CreateUploadBatchInput) {
  assertProductionDatabase();
  return hasDatabaseConfiguration()
    ? createDurableUploadBatch(input)
    : createUploadBatch(input);
}

export async function completeUploadBatchRuntime(
  input: CompleteDurableUploadBatchInput,
) {
  assertProductionDatabase();
  if (hasDatabaseConfiguration()) return completeDurableUploadBatch(input);

  return completeUploadBatch({
    userId: input.userId,
    batchId: input.batchId,
    items: (getUploadBatch(input.batchId, input.userId)?.items ?? []).map((item) => ({
      localId: item.localId,
      ciphertextSha256: item.ciphertextSha256,
      stagingRef: input.stagingObjectKey,
    })),
  });
}

export async function getUploadBatchRuntime(batchId: string, userId: string) {
  assertProductionDatabase();
  return hasDatabaseConfiguration()
    ? getDurableUploadBatch(batchId, userId)
    : getUploadBatch(batchId, userId);
}

export async function listUploadBatchesForUserRuntime(userId: string) {
  assertProductionDatabase();
  return hasDatabaseConfiguration()
    ? listDurableUploadBatchesForUser(userId)
    : listUploadBatchesForUser(userId);
}

export async function listPackPoolBatchesRuntime() {
  assertProductionDatabase();
  return hasDatabaseConfiguration()
    ? listDurableUploadBatchesForPackPool()
    : listUploadBatchesForPackPool();
}

export async function getAptAccountRuntime(userId: string) {
  assertProductionDatabase();
  return hasDatabaseConfiguration()
    ? getDurableAptAccount(userId)
    : getAptAccount(userId);
}

function assertProductionDatabase() {
  if (
    !hasDatabaseConfiguration() &&
    process.env.NODE_ENV === "production" &&
    process.env.VERCEL
  ) {
    throw new Error("Postgres is required for production upload state");
  }
}
