CREATE TYPE "public"."credit_ledger_entry_type" AS ENUM('testnet_grant', 'upload_reserve', 'upload_release', 'pack_settlement');--> statement-breakpoint
CREATE TYPE "public"."credit_status" AS ENUM('reserved', 'settled', 'payment_required');--> statement-breakpoint
CREATE TABLE "credit_accounts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"balance_microcredits" bigint NOT NULL,
	"reserved_microcredits" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"upload_batch_id" uuid,
	"pack_id" uuid,
	"type" "credit_ledger_entry_type" NOT NULL,
	"amount_microcredits" bigint NOT NULL,
	"reserved_delta_microcredits" bigint NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_billings" (
	"upload_batch_id" uuid PRIMARY KEY NOT NULL,
	"reserve_microcredits" bigint NOT NULL,
	"settled_microcredits" bigint,
	"credit_status" "credit_status" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "upload_batches" ADD COLUMN "staging_object_key" text;--> statement-breakpoint
ALTER TABLE "upload_batches" ADD COLUMN "staging_object_url" text;--> statement-breakpoint
ALTER TABLE "upload_batches" ADD COLUMN "pack_sha256" text;--> statement-breakpoint
ALTER TABLE "upload_batches" ADD COLUMN "pack_id" uuid;--> statement-breakpoint
ALTER TABLE "upload_items" ADD COLUMN "client_local_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_upload_batch_id_upload_batches_id_fk" FOREIGN KEY ("upload_batch_id") REFERENCES "public"."upload_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_billings" ADD CONSTRAINT "upload_billings_upload_batch_id_upload_batches_id_fk" FOREIGN KEY ("upload_batch_id") REFERENCES "public"."upload_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_idempotency_unique" ON "credit_ledger" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "credit_ledger_user_created_idx" ON "credit_ledger" USING btree ("user_id","created_at");