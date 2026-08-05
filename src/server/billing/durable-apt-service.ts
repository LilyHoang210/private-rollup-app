import { randomUUID } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { DIRECT_WITHDRAWAL_GAS_BUFFER_OCTAS } from "@/domain/apt";
import { DomainError } from "@/domain/errors";
import { getDatabase } from "@/server/db/client";
import { aptAccounts, aptLedger, custodialWallets } from "@/server/db/schema";
import { ensureDurableIdentity } from "@/server/uploads/durable-service";
import {
  decryptCustodialSigningMaterial,
  encryptCustodialSigningMaterial,
} from "./custodial-wallet-crypto";
import {
  generateCustodialWallet,
  getTestnetAptBalance,
  submitCustodialAptWithdrawal,
} from "./aptos-wallet";
import type { AptAccount } from "./apt-account-service";

export async function ensureDurableCustodialWallet(externalUserId: string) {
  const user = await ensureDurableIdentity(externalUserId);
  const db = getDatabase();
  const existing = await db.query.custodialWallets.findFirst({
    where: eq(custodialWallets.userId, user.id),
  });
  if (existing) return existing;

  const generated = generateCustodialWallet();
  const encryptedSigningMaterial = encryptCustodialSigningMaterial({
    privateKey: generated.privateKey,
    userId: user.id,
    address: generated.address,
  });
  const [created] = await db
    .insert(custodialWallets)
    .values({
      userId: user.id,
      address: generated.address,
      network: "testnet",
      encryptedSigningMaterial,
    })
    .onConflictDoNothing({ target: custodialWallets.userId })
    .returning();
  if (created) return created;
  const raced = await db.query.custodialWallets.findFirst({
    where: eq(custodialWallets.userId, user.id),
  });
  if (!raced) throw new Error("Could not create the user's APT deposit wallet");
  return raced;
}

export async function getDurableAptAccount(
  externalUserId: string,
): Promise<AptAccount & { wallet: WalletView }> {
  await syncDurableAptDeposits(externalUserId);
  return loadDurableAptAccount(externalUserId);
}

export async function syncDurableAptDeposits(externalUserId: string) {
  const wallet = await ensureDurableCustodialWallet(externalUserId);
  const observedBalanceOctas = await getTestnetAptBalance(wallet.address).catch(
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (/account_not_found|resource_not_found|404/i.test(message)) return 0;
      throw error;
    },
  );
  const db = getDatabase();
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${wallet.userId}))`);
    const [freshWallet, account] = await Promise.all([
      tx.query.custodialWallets.findFirst({
        where: eq(custodialWallets.userId, wallet.userId),
      }),
      tx.query.aptAccounts.findFirst({
        where: eq(aptAccounts.userId, wallet.userId),
      }),
    ]);
    if (!freshWallet || !account) throw new Error("APT account state is missing");
    const depositDelta = Math.max(
      0,
      observedBalanceOctas - freshWallet.lastObservedBalanceOctas,
    );
    if (depositDelta > 0) {
      await tx
        .update(aptAccounts)
        .set({
          balanceOctas: account.balanceOctas + depositDelta,
          updatedAt: new Date(),
        })
        .where(eq(aptAccounts.userId, wallet.userId));
      await tx.insert(aptLedger).values({
        userId: wallet.userId,
        type: "wallet_deposit",
        amountOctas: depositDelta,
        reservedDeltaOctas: 0,
        idempotencyKey: `wallet-deposit:${wallet.address}:${randomUUID()}`,
      });
    }
    await tx
      .update(custodialWallets)
      .set({
        totalDepositedOctas: freshWallet.totalDepositedOctas + depositDelta,
        lastObservedBalanceOctas: observedBalanceOctas,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(custodialWallets.userId, wallet.userId));
  });
  return loadDurableAptAccount(externalUserId);
}

export async function withdrawDurableApt(input: {
  externalUserId: string;
  destination: string;
  amountOctas: number;
  idempotencyKey: string;
}) {
  if (!Number.isSafeInteger(input.amountOctas) || input.amountOctas <= 0) {
    throw new DomainError("Withdrawal amount is invalid", "WITHDRAWAL_AMOUNT_INVALID");
  }
  if (!/^0x[a-f0-9]{1,64}$/i.test(input.destination)) {
    throw new DomainError("Withdrawal destination is invalid", "WITHDRAWAL_DESTINATION_INVALID");
  }
  if (!input.idempotencyKey.trim()) {
    throw new DomainError("Withdrawal idempotency key is required", "WITHDRAWAL_IDEMPOTENCY_REQUIRED");
  }

  await syncDurableAptDeposits(input.externalUserId);
  const wallet = await ensureDurableCustodialWallet(input.externalUserId);
  const db = getDatabase();
  const transactionHash = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${wallet.userId}))`);
    const existing = await tx.query.aptLedger.findFirst({
      where: eq(aptLedger.idempotencyKey, `withdrawal:${input.idempotencyKey}`),
    });
    if (existing?.transactionHash) return existing.transactionHash;

    const [account, freshWallet] = await Promise.all([
      tx.query.aptAccounts.findFirst({ where: eq(aptAccounts.userId, wallet.userId) }),
      tx.query.custodialWallets.findFirst({
        where: eq(custodialWallets.userId, wallet.userId),
      }),
    ]);
    if (!account || !freshWallet) throw new Error("APT account state is missing");
    const availableOctas = account.balanceOctas - account.reservedOctas;
    if (availableOctas < input.amountOctas) {
      throw new DomainError("Insufficient available APT", "APT_INSUFFICIENT");
    }
    if (availableOctas < input.amountOctas + DIRECT_WITHDRAWAL_GAS_BUFFER_OCTAS) {
      throw new DomainError(
        "Leave at least 0.006 APT in the service wallet for Aptos network gas.",
        "APT_WITHDRAWAL_GAS_BUFFER_REQUIRED",
      );
    }
    if (freshWallet.lastObservedBalanceOctas < input.amountOctas + DIRECT_WITHDRAWAL_GAS_BUFFER_OCTAS) {
      throw new DomainError(
        "The on-chain APT balance is lower than the requested withdrawal plus gas buffer",
        "APT_ONCHAIN_BALANCE_INSUFFICIENT",
      );
    }

    const custodialPrivateKey = decryptCustodialSigningMaterial({
      encrypted: freshWallet.encryptedSigningMaterial,
      userId: freshWallet.userId,
      address: freshWallet.address,
    });
    const withdrawal = await submitCustodialAptWithdrawal({
      custodialPrivateKey,
      destination: input.destination,
      amountOctas: input.amountOctas,
    });
    const totalDebitOctas = input.amountOctas + withdrawal.gasFeeOctas;
    await tx
      .update(aptAccounts)
      .set({
        balanceOctas: account.balanceOctas - totalDebitOctas,
        updatedAt: new Date(),
      })
      .where(eq(aptAccounts.userId, wallet.userId));
    await tx
      .update(custodialWallets)
      .set({
        lastObservedBalanceOctas:
          freshWallet.lastObservedBalanceOctas - totalDebitOctas,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(custodialWallets.userId, wallet.userId));
    await tx.insert(aptLedger).values({
      userId: wallet.userId,
      type: "withdrawal",
      amountOctas: -totalDebitOctas,
      reservedDeltaOctas: 0,
      transactionHash: withdrawal.transactionHash,
      idempotencyKey: `withdrawal:${input.idempotencyKey}`,
    });
    return withdrawal.transactionHash;
  });

  return {
    transactionHash,
    account: await loadDurableAptAccount(input.externalUserId),
  };
}

async function loadDurableAptAccount(
  externalUserId: string,
): Promise<AptAccount & { wallet: WalletView }> {
  const wallet = await ensureDurableCustodialWallet(externalUserId);
  const db = getDatabase();
  const [account, ledger] = await Promise.all([
    db.query.aptAccounts.findFirst({ where: eq(aptAccounts.userId, wallet.userId) }),
    db.query.aptLedger.findMany({
      where: eq(aptLedger.userId, wallet.userId),
      orderBy: [desc(aptLedger.createdAt)],
      limit: 100,
    }),
  ]);
  if (!account) throw new Error("Durable APT account was not created");
  return {
    userId: externalUserId,
    balanceOctas: account.balanceOctas,
    reservedOctas: account.reservedOctas,
    availableOctas: account.balanceOctas - account.reservedOctas,
    wallet: {
      address: wallet.address,
      network: "testnet",
      onChainBalanceOctas: wallet.lastObservedBalanceOctas,
      lastSyncedAt: wallet.lastSyncedAt?.toISOString(),
    },
    ledger: ledger.map((entry) => ({
      id: entry.id,
      type: entry.type === "testnet_grant" ? "wallet_deposit" : entry.type,
      amountOctas: entry.amountOctas,
      reservedDeltaOctas: entry.reservedDeltaOctas,
      uploadId: entry.uploadBatchId ?? undefined,
      packId: entry.packId ?? undefined,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}

interface WalletView {
  address: string;
  network: "testnet";
  onChainBalanceOctas: number;
  lastSyncedAt?: string;
}
