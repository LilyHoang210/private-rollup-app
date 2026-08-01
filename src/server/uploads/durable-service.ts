import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { RetentionCohort } from "@/domain/files";
import {
  MAX_BATCH_FILES,
  MAX_FILE_SIZE_BYTES,
  parseRetentionCohort,
  selectPackStrategy,
} from "@/domain/files";
import { estimateReserveMicrocredits } from "@/domain/credits";
import { DomainError } from "@/domain/errors";
import type { UploadStatus } from "@/domain/uploads";
import type { CreditAccount } from "@/server/billing/credit-service";
import { TESTNET_GRANT_MICROCREDITS } from "@/server/billing/credit-service";
import { getDatabase } from "@/server/db/client";
import {
  creditAccounts,
  creditLedger,
  packMembers,
  packs,
  uploadBatches,
  uploadBillings,
  uploadItems,
  users,
} from "@/server/db/schema";
import type {
  CompleteUploadBatchInput,
  CreateUploadBatchInput,
  UploadBatchRecord,
} from "./service";

export interface CompleteDurableUploadBatchInput
  extends Pick<CompleteUploadBatchInput, "userId" | "batchId"> {
  stagingObjectKey: string;
  stagingObjectUrl: string;
  packSha256: string;
  packSizeBytes: number;
}

export async function createDurableUploadBatch(
  input: CreateUploadBatchInput,
): Promise<UploadBatchRecord> {
  const db = getDatabase();
  const retentionDays = parseRetentionCohort(input.retentionDays);
  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey || input.items.length === 0) {
    throw new DomainError("Upload metadata is incomplete", "UPLOAD_INVALID");
  }
  validateItems(input.items);

  const batchId = randomUUID();
  await db.transaction(async (tx) => {
    const user = await ensureUser(tx, input.userId);
    const existing = await tx.query.uploadBatches.findFirst({
      where: and(
        eq(uploadBatches.userId, user.id),
        eq(uploadBatches.idempotencyKey, idempotencyKey),
      ),
      columns: { id: true },
    });
    if (existing) return;

    const totalCiphertextBytes = input.items.reduce(
      (total, item) => total + item.ciphertextSizeBytes,
      0,
    );
    const reserveMicrocredits = estimateReserveMicrocredits({
      ciphertextBytes: totalCiphertextBytes,
      retentionDays,
    });
    const account = await ensureCreditAccount(tx, user.id);
    const available = account.balanceMicrocredits - account.reservedMicrocredits;
    if (available < reserveMicrocredits) {
      throw new DomainError(
        "Insufficient credit for upload reserve",
        "CREDIT_INSUFFICIENT",
      );
    }

    const [createdBatch] = await tx
      .insert(uploadBatches)
      .values({
        id: batchId,
        userId: user.id,
        idempotencyKey,
        retentionDays: String(retentionDays) as "30" | "90" | "365",
        status: "staging",
        itemCount: input.items.length,
        ciphertextBytes: totalCiphertextBytes,
        encryptedManifest: "private-rollup-pack-v1",
      })
      .onConflictDoNothing({
        target: [uploadBatches.userId, uploadBatches.idempotencyKey],
      })
      .returning({ id: uploadBatches.id });
    if (!createdBatch) return;
    await tx.insert(uploadItems).values(
      input.items.map((item) => ({
        id: randomUUID(),
        batchId,
        userId: user.id,
        localIdHash: sha256(item.localId),
        clientLocalId: item.localId,
        strategy: selectPackStrategy(item.ciphertextSizeBytes),
        retentionDays: String(retentionDays) as "30" | "90" | "365",
        status: "staging" as const,
        sourceSizeBytes: item.plaintextSizeBytes,
        ciphertextBytes: item.ciphertextSizeBytes,
        ciphertextHash: item.ciphertextSha256.toLowerCase(),
        encryptedMetadata: item.encryptedManifest,
        wrappedDek: item.wrappedDek,
      })),
    );
    await tx.insert(uploadBillings).values({
      uploadBatchId: batchId,
      reserveMicrocredits,
      creditStatus: "reserved",
    });
    await tx
      .update(creditAccounts)
      .set({
        reservedMicrocredits: account.reservedMicrocredits + reserveMicrocredits,
        updatedAt: new Date(),
      })
      .where(eq(creditAccounts.userId, user.id));
    await tx.insert(creditLedger).values({
      userId: user.id,
      uploadBatchId: batchId,
      type: "upload_reserve",
      amountMicrocredits: 0,
      reservedDeltaMicrocredits: reserveMicrocredits,
      idempotencyKey: `upload-reserve:${batchId}`,
    });
  });

  const created = await getDurableUploadBatch(batchId, input.userId);
  if (created) return created;
  const existing = await findByIdempotencyKey(input.userId, idempotencyKey);
  if (!existing) throw new Error("Durable upload batch was not created");
  return existing;
}

export async function completeDurableUploadBatch(
  input: CompleteDurableUploadBatchInput,
): Promise<UploadBatchRecord> {
  assertStagingReference(input);
  const db = getDatabase();
  const user = await findUser(input.userId);
  if (!user) throw new DomainError("Upload batch not found", "UPLOAD_NOT_FOUND");

  const [updated] = await db
    .update(uploadBatches)
    .set({
      status: "waiting_for_pack",
      stagingObjectKey: input.stagingObjectKey,
      stagingObjectUrl: input.stagingObjectUrl,
      packSha256: input.packSha256.toLowerCase(),
      updatedAt: new Date(),
    })
    .where(
      and(eq(uploadBatches.id, input.batchId), eq(uploadBatches.userId, user.id)),
    )
    .returning({ id: uploadBatches.id });
  if (!updated) throw new DomainError("Upload batch not found", "UPLOAD_NOT_FOUND");

  await db
    .update(uploadItems)
    .set({
      status: "waiting_for_pack",
      stagingObjectKey: input.stagingObjectKey,
      updatedAt: new Date(),
    })
    .where(eq(uploadItems.batchId, input.batchId));

  const batch = await getDurableUploadBatch(input.batchId, input.userId);
  if (!batch) throw new Error("Durable upload batch disappeared after staging");
  return batch;
}

export async function getDurableUploadBatch(batchId: string, userId: string) {
  const user = await findUser(userId);
  if (!user) return undefined;
  const db = getDatabase();
  const batch = await db.query.uploadBatches.findFirst({
    where: and(eq(uploadBatches.id, batchId), eq(uploadBatches.userId, user.id)),
  });
  return batch ? loadBatchRecord(batch) : undefined;
}

export async function listDurableUploadBatchesForUser(userId: string) {
  const user = await findUser(userId);
  if (!user) return [];
  const db = getDatabase();
  const batches = await db.query.uploadBatches.findMany({
    where: eq(uploadBatches.userId, user.id),
    orderBy: [desc(uploadBatches.createdAt)],
  });
  return Promise.all(batches.map(loadBatchRecord));
}

export async function getDurableCreditAccount(userId: string): Promise<CreditAccount> {
  const db = getDatabase();
  const user = await db.transaction((tx) => ensureUser(tx, userId));
  await db.transaction((tx) => ensureCreditAccount(tx, user.id));
  const [account, ledger] = await Promise.all([
    db.query.creditAccounts.findFirst({ where: eq(creditAccounts.userId, user.id) }),
    db.query.creditLedger.findMany({
      where: eq(creditLedger.userId, user.id),
      orderBy: [desc(creditLedger.createdAt)],
      limit: 100,
    }),
  ]);
  if (!account) throw new Error("Durable credit account was not created");
  return {
    userId,
    balanceMicrocredits: account.balanceMicrocredits,
    reservedMicrocredits: account.reservedMicrocredits,
    availableMicrocredits:
      account.balanceMicrocredits - account.reservedMicrocredits,
    ledger: ledger.map((entry) => ({
      id: entry.id,
      type: entry.type,
      amountMicrocredits: entry.amountMicrocredits,
      reservedDeltaMicrocredits: entry.reservedDeltaMicrocredits,
      uploadId: entry.uploadBatchId ?? undefined,
      packId: entry.packId ?? undefined,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}

async function findByIdempotencyKey(userId: string, idempotencyKey: string) {
  const user = await findUser(userId);
  if (!user) return undefined;
  const db = getDatabase();
  const batch = await db.query.uploadBatches.findFirst({
    where: and(
      eq(uploadBatches.userId, user.id),
      eq(uploadBatches.idempotencyKey, idempotencyKey),
    ),
  });
  return batch ? loadBatchRecord(batch) : undefined;
}

async function loadBatchRecord(batch: typeof uploadBatches.$inferSelect) {
  const db = getDatabase();
  const [items, billing, pack, member] = await Promise.all([
    db.query.uploadItems.findMany({
      where: eq(uploadItems.batchId, batch.id),
      orderBy: [uploadItems.createdAt],
    }),
    db.query.uploadBillings.findFirst({
      where: eq(uploadBillings.uploadBatchId, batch.id),
    }),
    batch.packId
      ? db.query.packs.findFirst({ where: eq(packs.id, batch.packId) })
      : undefined,
    db
      .select({
        byteStart: packMembers.byteStart,
        byteLength: packMembers.byteLength,
        ciphertextHash: packMembers.ciphertextHash,
      })
      .from(packMembers)
      .innerJoin(uploadItems, eq(packMembers.uploadItemId, uploadItems.id))
      .where(eq(uploadItems.batchId, batch.id))
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  const storage =
    pack?.status === "verified" &&
    pack.blobId &&
    pack.ownerAddress &&
    pack.downloadUrl &&
    pack.ciphertextHash
      ? {
          driver: "shelby" as const,
          network: "shelbynet" as const,
          verified: true as const,
          ownerAddress: pack.ownerAddress,
          blobId: pack.blobId,
          blobName: pack.blobName,
          blobSizeBytes: pack.ciphertextBytes,
          ciphertextSha256: pack.ciphertextHash,
          transactionHash: pack.transactionHash ?? undefined,
          expiresAt: pack.expiresAt.toISOString(),
          downloadUrl: pack.downloadUrl,
          packRange: member
            ? {
                byteStart: member.byteStart,
                byteLength: member.byteLength,
                ciphertextSha256: member.ciphertextHash,
              }
            : undefined,
        }
      : undefined;

  return {
    id: batch.id,
    userId: batch.userId,
    idempotencyKey: batch.idempotencyKey,
    retentionDays: Number(batch.retentionDays) as RetentionCohort,
    status: batch.status as UploadStatus,
    totalCiphertextSizeBytes: batch.ciphertextBytes,
    billing: billing
      ? {
          uploadId: batch.id,
          reserveMicrocredits: billing.reserveMicrocredits,
          settledMicrocredits: billing.settledMicrocredits ?? undefined,
          creditStatus: billing.creditStatus,
        }
      : undefined,
    storage,
    items: items.map((item) => ({
      id: item.id,
      batchId: batch.id,
      localId: item.clientLocalId,
      label: "Encrypted file",
      category: "other" as const,
      plaintextSizeBytes: item.sourceSizeBytes,
      ciphertextSizeBytes: item.ciphertextBytes,
      ciphertextSha256: item.ciphertextHash,
      encryptedManifest: item.encryptedMetadata,
      wrappedDek: item.wrappedDek,
      status: item.status as UploadStatus,
      packStrategy: item.strategy,
      stagingRef: item.stagingObjectKey ? "private-staging" : undefined,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
  } satisfies UploadBatchRecord;
}

async function findUser(externalUserId: string) {
  const walletAddressHash = walletHash(externalUserId);
  return getDatabase().query.users.findFirst({
    where: eq(users.walletAddressHash, walletAddressHash),
  });
}

async function ensureUser(
  tx: Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0],
  externalUserId: string,
) {
  const walletAddressHash = walletHash(externalUserId);
  const existing = await tx.query.users.findFirst({
    where: eq(users.walletAddressHash, walletAddressHash),
  });
  if (existing) return existing;

  const [created] = await tx
    .insert(users)
    .values({
      walletAddressHash,
      ownerFingerprint: `wallet-${walletAddressHash}`,
    })
    .onConflictDoNothing({ target: users.walletAddressHash })
    .returning();
  if (created) return created;
  const raced = await tx.query.users.findFirst({
    where: eq(users.walletAddressHash, walletAddressHash),
  });
  if (!raced) throw new Error("Could not create durable user");
  return raced;
}

async function ensureCreditAccount(
  tx: Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0],
  userId: string,
) {
  await tx
    .insert(creditAccounts)
    .values({
      userId,
      balanceMicrocredits: TESTNET_GRANT_MICROCREDITS,
      reservedMicrocredits: 0,
    })
    .onConflictDoNothing({ target: creditAccounts.userId });
  await tx
    .insert(creditLedger)
    .values({
      userId,
      type: "testnet_grant",
      amountMicrocredits: TESTNET_GRANT_MICROCREDITS,
      reservedDeltaMicrocredits: 0,
      idempotencyKey: `testnet-grant:${userId}`,
    })
    .onConflictDoNothing({ target: creditLedger.idempotencyKey });
  const account = await tx.query.creditAccounts.findFirst({
    where: eq(creditAccounts.userId, userId),
  });
  if (!account) throw new Error("Could not create durable credit account");
  return account;
}

function assertStagingReference(input: CompleteDurableUploadBatchInput) {
  if (!/^[a-f0-9]{64}$/i.test(input.packSha256)) {
    throw new DomainError("Pack checksum is invalid", "UPLOAD_CHECKSUM_INVALID");
  }
  if (!Number.isSafeInteger(input.packSizeBytes) || input.packSizeBytes <= 0) {
    throw new DomainError("Pack size is invalid", "UPLOAD_SIZE_INVALID");
  }
  if (!input.stagingObjectKey.startsWith(`staging/${input.batchId}/`)) {
    throw new DomainError("Staging object does not belong to this upload", "UPLOAD_STAGING_REF_INVALID");
  }
  const url = new URL(input.stagingObjectUrl);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".private.blob.vercel-storage.com")) {
    throw new DomainError("Staging object URL is invalid", "UPLOAD_STAGING_REF_INVALID");
  }
}

function walletHash(userId: string) {
  const value = userId.startsWith("wallet:") ? userId.slice(7) : userId;
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new DomainError("Wallet session identity is invalid", "AUTH_INVALID");
  }
  return value.toLowerCase();
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function validateItems(input: CreateUploadBatchInput["items"]) {
  if (input.length > MAX_BATCH_FILES) {
    throw new DomainError("Upload batch exceeds file limit", "UPLOAD_ITEMS_LIMIT");
  }
  const localIds = new Set<string>();
  for (const item of input) {
    if (!item.localId.trim() || localIds.has(item.localId)) {
      throw new DomainError("Upload items require unique local IDs", "UPLOAD_LOCAL_ID_INVALID");
    }
    localIds.add(item.localId);
    if (
      !Number.isSafeInteger(item.plaintextSizeBytes) ||
      item.plaintextSizeBytes < 0 ||
      item.plaintextSizeBytes > MAX_FILE_SIZE_BYTES ||
      !Number.isSafeInteger(item.ciphertextSizeBytes) ||
      item.ciphertextSizeBytes < item.plaintextSizeBytes ||
      !/^[a-f0-9]{64}$/i.test(item.ciphertextSha256)
    ) {
      throw new DomainError("Upload item sizes or checksum are invalid", "UPLOAD_SIZE_INVALID");
    }
  }
}
