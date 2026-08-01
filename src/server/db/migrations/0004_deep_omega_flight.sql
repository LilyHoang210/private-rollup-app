ALTER TYPE "public"."credit_ledger_entry_type" ADD VALUE 'wallet_deposit' BEFORE 'upload_reserve';--> statement-breakpoint
ALTER TYPE "public"."credit_ledger_entry_type" ADD VALUE 'withdrawal' AFTER 'pack_settlement';--> statement-breakpoint
ALTER TYPE "public"."credit_status" RENAME TO "payment_status";--> statement-breakpoint
ALTER TYPE "public"."credit_ledger_entry_type" RENAME TO "apt_ledger_entry_type";--> statement-breakpoint
ALTER TABLE "credit_accounts" RENAME TO "apt_accounts";--> statement-breakpoint
ALTER TABLE "credit_ledger" RENAME TO "apt_ledger";--> statement-breakpoint
ALTER TABLE "apt_accounts" RENAME CONSTRAINT "credit_accounts_user_id_users_id_fk" TO "apt_accounts_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "apt_ledger" RENAME CONSTRAINT "credit_ledger_user_id_users_id_fk" TO "apt_ledger_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "apt_ledger" RENAME CONSTRAINT "credit_ledger_upload_batch_id_upload_batches_id_fk" TO "apt_ledger_upload_batch_id_upload_batches_id_fk";--> statement-breakpoint
ALTER TABLE "apt_ledger" RENAME CONSTRAINT "credit_ledger_pack_id_packs_id_fk" TO "apt_ledger_pack_id_packs_id_fk";--> statement-breakpoint
ALTER TABLE "apt_accounts" RENAME COLUMN "balance_microcredits" TO "balance_octas";--> statement-breakpoint
ALTER TABLE "apt_accounts" RENAME COLUMN "reserved_microcredits" TO "reserved_octas";--> statement-breakpoint
ALTER TABLE "upload_billings" RENAME COLUMN "reserve_microcredits" TO "reserve_octas";--> statement-breakpoint
ALTER TABLE "upload_billings" RENAME COLUMN "settled_microcredits" TO "settled_octas";--> statement-breakpoint
ALTER TABLE "upload_billings" RENAME COLUMN "credit_status" TO "payment_status";--> statement-breakpoint
ALTER TABLE "apt_ledger" RENAME COLUMN "amount_microcredits" TO "amount_octas";--> statement-breakpoint
ALTER TABLE "apt_ledger" RENAME COLUMN "reserved_delta_microcredits" TO "reserved_delta_octas";--> statement-breakpoint
ALTER TABLE "apt_ledger" ADD COLUMN "transaction_hash" text;--> statement-breakpoint
ALTER INDEX "credit_ledger_idempotency_unique" RENAME TO "apt_ledger_idempotency_unique";--> statement-breakpoint
ALTER INDEX "credit_ledger_user_created_idx" RENAME TO "apt_ledger_user_created_idx";--> statement-breakpoint
CREATE TABLE "custodial_wallets" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"network" text NOT NULL,
	"encrypted_signing_material" text NOT NULL,
	"total_deposited_octas" bigint DEFAULT 0 NOT NULL,
	"last_observed_balance_octas" bigint DEFAULT 0 NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custodial_wallets" ADD CONSTRAINT "custodial_wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "custodial_wallets_address_unique" ON "custodial_wallets" USING btree ("address");
--> statement-breakpoint
DELETE FROM "apt_ledger" WHERE "type" = 'testnet_grant';
--> statement-breakpoint
UPDATE "apt_accounts"
SET "balance_octas" = 0,
    "reserved_octas" = 0,
    "updated_at" = now();
