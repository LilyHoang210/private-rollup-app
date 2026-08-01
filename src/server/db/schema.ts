import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const retentionCohortEnum = pgEnum("retention_cohort", [
  "30",
  "90",
  "365",
]);

export const packStrategyEnum = pgEnum("pack_strategy", [
  "shared_pack",
  "dedicated_blob",
]);

export const uploadStatusEnum = pgEnum("upload_status", [
  "encrypting",
  "staging",
  "staged",
  "waiting_for_pack",
  "packing",
  "registering",
  "written",
  "verifying",
  "available",
  "retrying",
  "failed",
]);

export const packStatusEnum = pgEnum("pack_status", [
  "open",
  "sealing",
  "registering",
  "written",
  "verifying",
  "verified",
  "retrying",
  "failed",
  "expired",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "leased",
  "succeeded",
  "retrying",
  "failed",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletAddressHash: text("wallet_address_hash").notNull(),
    ownerFingerprint: text("owner_fingerprint").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_wallet_address_hash_unique").on(table.walletAddressHash),
    uniqueIndex("users_owner_fingerprint_unique").on(table.ownerFingerprint),
  ],
);

export const walletChallenges = pgTable(
  "wallet_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletAddressHash: text("wallet_address_hash").notNull(),
    nonceHash: text("nonce_hash").notNull(),
    domain: text("domain").notNull(),
    uri: text("uri").notNull(),
    chainId: text("chain_id").notNull(),
    statementHash: text("statement_hash").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("wallet_challenges_nonce_hash_unique").on(table.nonceHash),
    index("wallet_challenges_wallet_address_hash_idx").on(table.walletAddressHash),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
  ],
);

export const vaultPublicKeys = pgTable(
  "vault_public_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    ownerFingerprint: text("owner_fingerprint").notNull(),
    publicKeyBytes: text("public_key_bytes").notNull(),
    algorithm: text("algorithm").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("vault_public_keys_owner_fingerprint_unique").on(
      table.ownerFingerprint,
    ),
    index("vault_public_keys_user_id_idx").on(table.userId),
  ],
);

export const uploadBatches = pgTable(
  "upload_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    idempotencyKey: text("idempotency_key").notNull(),
    retentionDays: retentionCohortEnum("retention_days").notNull(),
    status: uploadStatusEnum("status").notNull(),
    itemCount: integer("item_count").notNull(),
    ciphertextBytes: bigint("ciphertext_bytes", { mode: "number" }).notNull(),
    encryptedManifest: text("encrypted_manifest").notNull(),
    stagingObjectKey: text("staging_object_key"),
    stagingObjectUrl: text("staging_object_url"),
    packSha256: text("pack_sha256"),
    packId: uuid("pack_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("upload_batches_user_id_idempotency_unique").on(
      table.userId,
      table.idempotencyKey,
    ),
    index("upload_batches_user_status_idx").on(table.userId, table.status),
  ],
);

export const uploadItems = pgTable(
  "upload_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => uploadBatches.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    localIdHash: text("local_id_hash").notNull(),
    clientLocalId: text("client_local_id").notNull(),
    strategy: packStrategyEnum("strategy").notNull(),
    retentionDays: retentionCohortEnum("retention_days").notNull(),
    status: uploadStatusEnum("status").notNull(),
    sourceSizeBytes: bigint("source_size_bytes", { mode: "number" }).notNull(),
    ciphertextBytes: bigint("ciphertext_bytes", { mode: "number" }).notNull(),
    ciphertextHash: text("ciphertext_hash").notNull(),
    encryptedMetadata: text("encrypted_metadata").notNull(),
    wrappedDek: text("wrapped_dek").notNull(),
    stagingObjectKey: text("staging_object_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("upload_items_batch_local_unique").on(
      table.batchId,
      table.localIdHash,
    ),
    index("upload_items_pack_queue_idx").on(
      table.strategy,
      table.retentionDays,
      table.status,
    ),
  ],
);

export const packs = pgTable(
  "packs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    strategy: packStrategyEnum("strategy").notNull(),
    retentionDays: retentionCohortEnum("retention_days").notNull(),
    status: packStatusEnum("status").notNull(),
    blobId: text("blob_id"),
    blobName: text("blob_name").notNull(),
    ownerAddress: text("owner_address"),
    downloadUrl: text("download_url"),
    driver: text("driver").notNull(),
    network: text("network").notNull(),
    ciphertextBytes: bigint("ciphertext_bytes", { mode: "number" }).notNull(),
    ciphertextHash: text("ciphertext_hash"),
    transactionHash: text("transaction_hash"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    sealedAt: timestamp("sealed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("packs_blob_name_unique").on(table.blobName),
    index("packs_status_retention_idx").on(table.status, table.retentionDays),
  ],
);

export const creditStatusEnum = pgEnum("credit_status", [
  "reserved",
  "settled",
  "payment_required",
]);

export const creditLedgerEntryTypeEnum = pgEnum("credit_ledger_entry_type", [
  "testnet_grant",
  "upload_reserve",
  "upload_release",
  "pack_settlement",
]);

export const creditAccounts = pgTable("credit_accounts", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  balanceMicrocredits: bigint("balance_microcredits", { mode: "number" }).notNull(),
  reservedMicrocredits: bigint("reserved_microcredits", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const uploadBillings = pgTable("upload_billings", {
  uploadBatchId: uuid("upload_batch_id")
    .primaryKey()
    .references(() => uploadBatches.id),
  reserveMicrocredits: bigint("reserve_microcredits", { mode: "number" }).notNull(),
  settledMicrocredits: bigint("settled_microcredits", { mode: "number" }),
  creditStatus: creditStatusEnum("credit_status").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    uploadBatchId: uuid("upload_batch_id").references(() => uploadBatches.id),
    packId: uuid("pack_id").references(() => packs.id),
    type: creditLedgerEntryTypeEnum("type").notNull(),
    amountMicrocredits: bigint("amount_microcredits", { mode: "number" }).notNull(),
    reservedDeltaMicrocredits: bigint("reserved_delta_microcredits", {
      mode: "number",
    }).notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("credit_ledger_idempotency_unique").on(table.idempotencyKey),
    index("credit_ledger_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const packMembers = pgTable(
  "pack_members",
  {
    packId: uuid("pack_id")
      .notNull()
      .references(() => packs.id),
    uploadItemId: uuid("upload_item_id")
      .notNull()
      .references(() => uploadItems.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    byteStart: bigint("byte_start", { mode: "number" }).notNull(),
    byteLength: bigint("byte_length", { mode: "number" }).notNull(),
    ciphertextHash: text("ciphertext_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.packId, table.uploadItemId] }),
    uniqueIndex("pack_members_upload_item_unique").on(table.uploadItemId),
    index("pack_members_user_id_idx").on(table.userId),
  ],
);

export const receipts = pgTable(
  "receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packId: uuid("pack_id")
      .notNull()
      .references(() => packs.id),
    uploadItemId: uuid("upload_item_id")
      .notNull()
      .references(() => uploadItems.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    ownerFingerprint: text("owner_fingerprint").notNull(),
    formatVersion: integer("format_version").notNull(),
    receiptJson: jsonb("receipt_json").notNull(),
    receiptHash: text("receipt_hash").notNull(),
    serviceSignature: text("service_signature").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("receipts_upload_item_unique").on(table.uploadItemId),
    uniqueIndex("receipts_receipt_hash_unique").on(table.receiptHash),
    index("receipts_user_pack_idx").on(table.userId, table.packId),
  ],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    status: jobStatusEnum("status").notNull(),
    deduplicationKey: text("deduplication_key").notNull(),
    payload: jsonb("payload").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    lockedBy: text("locked_by"),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    lastErrorCode: text("last_error_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("jobs_deduplication_key_unique").on(table.deduplicationKey),
    index("jobs_claim_idx").on(table.status, table.runAfter, table.lockedUntil),
  ],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    delivered: boolean("delivered").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("outbox_events_delivery_idx").on(table.delivered, table.createdAt),
  ],
);

export const schemaTables = {
  users,
  walletChallenges,
  sessions,
  vaultPublicKeys,
  uploadBatches,
  uploadItems,
  packs,
  creditAccounts,
  uploadBillings,
  creditLedger,
  packMembers,
  receipts,
  jobs,
  outboxEvents,
};
