import { createHash, randomUUID } from "node:crypto";
import { del, get } from "@vercel/blob";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  allocatePackCostByBytes,
  estimateReserveMicrocredits,
} from "@/domain/credits";
import type { RetentionCohort } from "@/domain/files";
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
import { writeEncryptedPack } from "@/server/storage/shelby-writer";
import { selectPackCandidates } from "./pack-selection";
import { assembleSharedPack } from "./shared-pack";

export interface ClosePackResult {
  status: "idle" | "verified";
  packId?: string;
  batchIds: string[];
}

export async function closeEligiblePack(input: {
  forceBatchId?: string;
  requestingUserId?: string;
  now?: Date;
} = {}): Promise<ClosePackResult> {
  const db = getDatabase();
  const waiting = await db.query.uploadBatches.findMany({
    where: inArray(uploadBatches.status, ["waiting_for_pack", "retrying"]),
    orderBy: [asc(uploadBatches.createdAt)],
  });
  const staged = waiting.filter(
    (batch) => batch.stagingObjectUrl && batch.stagingObjectKey && batch.packSha256,
  );

  if (input.forceBatchId && input.requestingUserId) {
    const walletAddressHash = input.requestingUserId.replace(/^wallet:/, "");
    const user = await db.query.users.findFirst({
      where: eq(users.walletAddressHash, walletAddressHash),
    });
    const requested = staged.find((batch) => batch.id === input.forceBatchId);
    if (!user || !requested || requested.userId !== user.id) {
      throw new Error("The requested upload batch was not found for this wallet");
    }
  }

  const itemStrategies = await Promise.all(
    staged.map(async (batch) => ({
      batch,
      dedicated: Boolean(
        await db.query.uploadItems.findFirst({
          where: and(
            eq(uploadItems.batchId, batch.id),
            eq(uploadItems.strategy, "dedicated_blob"),
          ),
          columns: { id: true },
        }),
      ),
    })),
  );
  const selected = selectPackCandidates({
    now: input.now ?? new Date(),
    forceBatchId: input.forceBatchId,
    candidates: itemStrategies.map(({ batch, dedicated }) => ({
      id: batch.id,
      retentionDays: Number(batch.retentionDays) as RetentionCohort,
      packBytes: batch.ciphertextBytes,
      createdAt: batch.createdAt,
      dedicated,
    })),
  });
  if (selected.length === 0) return { status: "idle", batchIds: [] };

  const selectedBatches = selected.map((candidate) => {
    const batch = staged.find((item) => item.id === candidate.id);
    if (!batch) throw new Error("Selected pack member disappeared");
    return batch;
  });
  const selectedIds = selectedBatches.map((batch) => batch.id);
  const claimed = await db
    .update(uploadBatches)
    .set({ status: "packing", updatedAt: new Date() })
    .where(
      and(
        inArray(uploadBatches.id, selectedIds),
        inArray(uploadBatches.status, ["waiting_for_pack", "retrying"]),
      ),
    )
    .returning({ id: uploadBatches.id });
  if (claimed.length !== selectedIds.length) {
    await db
      .update(uploadBatches)
      .set({ status: "waiting_for_pack", updatedAt: new Date() })
      .where(inArray(uploadBatches.id, claimed.map((item) => item.id)));
    return { status: "idle", batchIds: [] };
  }

  const packId = randomUUID();
  try {
    const memberBytes = await Promise.all(
      selectedBatches.map(async (batch) => ({
        batchId: batch.id,
        bytes: await readStagedPack(
          batch.stagingObjectUrl!,
          batch.packSha256!,
        ),
      })),
    );
    const assembled = await assembleSharedPack(memberBytes);
    const retentionDays = Number(selectedBatches[0].retentionDays) as RetentionCohort;
    const storage = await writeEncryptedPack({
      batchId: `pack-${packId}`,
      bytes: assembled.bytes,
      sha256: assembled.sha256,
      retentionDays,
    });
    const totalCostMicrocredits = estimateReserveMicrocredits({
      ciphertextBytes: assembled.bytes.byteLength,
      retentionDays,
    });
    const allocations = allocatePackCostByBytes({
      totalCostMicrocredits,
      members: assembled.members.map((member) => ({
        memberId: member.batchId,
        ciphertextBytes: member.byteLength,
      })),
    });

    await db.transaction(async (tx) => {
      await tx.insert(packs).values({
        id: packId,
        strategy: selectedBatches.length === 1 && selected[0].dedicated
          ? "dedicated_blob"
          : "shared_pack",
        retentionDays: String(retentionDays) as "30" | "90" | "365",
        status: "verified",
        blobId: storage.blobId,
        blobName: storage.blobName,
        ownerAddress: storage.ownerAddress,
        downloadUrl: storage.downloadUrl,
        driver: storage.driver,
        network: storage.network,
        ciphertextBytes: storage.blobSizeBytes,
        ciphertextHash: storage.ciphertextSha256,
        transactionHash: storage.transactionHash,
        sealedAt: new Date(),
        expiresAt: new Date(storage.expiresAt),
      });

      for (const batch of selectedBatches) {
        const member = assembled.members.find((item) => item.batchId === batch.id)!;
        const allocation = allocations.find((item) => item.memberId === batch.id)!;
        const items = await tx.query.uploadItems.findMany({
          where: eq(uploadItems.batchId, batch.id),
        });
        await tx.insert(packMembers).values(
          items.map((item) => ({
            packId,
            uploadItemId: item.id,
            userId: batch.userId,
            byteStart: member.byteStart,
            byteLength: member.byteLength,
            ciphertextHash: member.ciphertextSha256,
          })),
        );
        await settleBatch(tx, {
          batchId: batch.id,
          userId: batch.userId,
          packId,
          costMicrocredits: allocation.costMicrocredits,
        });
        await tx
          .update(uploadBatches)
          .set({ status: "available", packId, updatedAt: new Date() })
          .where(eq(uploadBatches.id, batch.id));
        await tx
          .update(uploadItems)
          .set({ status: "available", updatedAt: new Date() })
          .where(eq(uploadItems.batchId, batch.id));
      }
    });

    await del(selectedBatches.map((batch) => batch.stagingObjectUrl!)).catch(
      () => undefined,
    );
    return { status: "verified", packId, batchIds: selectedIds };
  } catch (error) {
    await db
      .update(uploadBatches)
      .set({ status: "retrying", updatedAt: new Date() })
      .where(inArray(uploadBatches.id, selectedIds));
    throw error;
  }
}

async function readStagedPack(url: string, expectedSha256: string) {
  const result = await get(url, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error("Private staging object is unavailable");
  }
  const bytes = new Uint8Array(await new Response(result.stream).arrayBuffer());
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (actualHash !== expectedSha256.toLowerCase()) {
    throw new Error("Private staging checksum does not match upload metadata");
  }
  return bytes;
}

async function settleBatch(
  tx: Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0],
  input: {
    batchId: string;
    userId: string;
    packId: string;
    costMicrocredits: number;
  },
) {
  const [billing, account] = await Promise.all([
    tx.query.uploadBillings.findFirst({
      where: eq(uploadBillings.uploadBatchId, input.batchId),
    }),
    tx.query.creditAccounts.findFirst({
      where: eq(creditAccounts.userId, input.userId),
    }),
  ]);
  if (!billing || !account) throw new Error("Pack member billing state is missing");

  const spendableIncludingOwnReserve =
    account.balanceMicrocredits -
    Math.max(0, account.reservedMicrocredits - billing.reserveMicrocredits);
  const settled = spendableIncludingOwnReserve >= input.costMicrocredits;
  await tx
    .update(uploadBillings)
    .set({
      creditStatus: settled ? "settled" : "payment_required",
      settledMicrocredits: settled ? input.costMicrocredits : null,
      updatedAt: new Date(),
    })
    .where(eq(uploadBillings.uploadBatchId, input.batchId));
  if (!settled) return;

  await tx
    .update(creditAccounts)
    .set({
      balanceMicrocredits: account.balanceMicrocredits - input.costMicrocredits,
      reservedMicrocredits: Math.max(
        0,
        account.reservedMicrocredits - billing.reserveMicrocredits,
      ),
      updatedAt: new Date(),
    })
    .where(eq(creditAccounts.userId, input.userId));
  await tx.insert(creditLedger).values({
    userId: input.userId,
    uploadBatchId: input.batchId,
    packId: input.packId,
    type: "pack_settlement",
    amountMicrocredits: -input.costMicrocredits,
    reservedDeltaMicrocredits: -billing.reserveMicrocredits,
    idempotencyKey: `pack-settlement:${input.packId}:${input.batchId}`,
  });
}
