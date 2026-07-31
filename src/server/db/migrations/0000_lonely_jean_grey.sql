CREATE TYPE "public"."job_status" AS ENUM('queued', 'leased', 'succeeded', 'retrying', 'failed');--> statement-breakpoint
CREATE TYPE "public"."pack_status" AS ENUM('open', 'sealing', 'registering', 'written', 'verifying', 'verified', 'retrying', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."pack_strategy" AS ENUM('shared_pack', 'dedicated_blob');--> statement-breakpoint
CREATE TYPE "public"."retention_cohort" AS ENUM('30', '90', '365');--> statement-breakpoint
CREATE TYPE "public"."upload_status" AS ENUM('encrypting', 'staging', 'staged', 'waiting_for_pack', 'packing', 'registering', 'written', 'verifying', 'available', 'retrying', 'failed');--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"status" "job_status" NOT NULL,
	"deduplication_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"locked_by" text,
	"locked_until" timestamp with time zone,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"delivered" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pack_members" (
	"pack_id" uuid NOT NULL,
	"upload_item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"byte_start" bigint NOT NULL,
	"byte_length" bigint NOT NULL,
	"ciphertext_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pack_members_pack_id_upload_item_id_pk" PRIMARY KEY("pack_id","upload_item_id")
);
--> statement-breakpoint
CREATE TABLE "packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"strategy" "pack_strategy" NOT NULL,
	"retention_days" "retention_cohort" NOT NULL,
	"status" "pack_status" NOT NULL,
	"blob_id" text,
	"blob_name" text NOT NULL,
	"driver" text NOT NULL,
	"network" text NOT NULL,
	"ciphertext_bytes" bigint NOT NULL,
	"ciphertext_hash" text,
	"transaction_hash" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sealed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_id" uuid NOT NULL,
	"upload_item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"owner_fingerprint" text NOT NULL,
	"format_version" integer NOT NULL,
	"receipt_json" jsonb NOT NULL,
	"receipt_hash" text NOT NULL,
	"service_signature" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"retention_days" "retention_cohort" NOT NULL,
	"status" "upload_status" NOT NULL,
	"item_count" integer NOT NULL,
	"ciphertext_bytes" bigint NOT NULL,
	"encrypted_manifest" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"local_id_hash" text NOT NULL,
	"strategy" "pack_strategy" NOT NULL,
	"retention_days" "retention_cohort" NOT NULL,
	"status" "upload_status" NOT NULL,
	"ciphertext_bytes" bigint NOT NULL,
	"ciphertext_hash" text NOT NULL,
	"encrypted_metadata" text NOT NULL,
	"wrapped_dek" text NOT NULL,
	"staging_object_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address_hash" text NOT NULL,
	"owner_fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_public_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"owner_fingerprint" text NOT NULL,
	"public_key_bytes" text NOT NULL,
	"algorithm" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wallet_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address_hash" text NOT NULL,
	"nonce_hash" text NOT NULL,
	"domain" text NOT NULL,
	"uri" text NOT NULL,
	"chain_id" text NOT NULL,
	"statement_hash" text NOT NULL,
	"used_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pack_members" ADD CONSTRAINT "pack_members_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_members" ADD CONSTRAINT "pack_members_upload_item_id_upload_items_id_fk" FOREIGN KEY ("upload_item_id") REFERENCES "public"."upload_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_members" ADD CONSTRAINT "pack_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_upload_item_id_upload_items_id_fk" FOREIGN KEY ("upload_item_id") REFERENCES "public"."upload_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_batches" ADD CONSTRAINT "upload_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_items" ADD CONSTRAINT "upload_items_batch_id_upload_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."upload_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_items" ADD CONSTRAINT "upload_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_public_keys" ADD CONSTRAINT "vault_public_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_deduplication_key_unique" ON "jobs" USING btree ("deduplication_key");--> statement-breakpoint
CREATE INDEX "jobs_claim_idx" ON "jobs" USING btree ("status","run_after","locked_until");--> statement-breakpoint
CREATE INDEX "outbox_events_delivery_idx" ON "outbox_events" USING btree ("delivered","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pack_members_upload_item_unique" ON "pack_members" USING btree ("upload_item_id");--> statement-breakpoint
CREATE INDEX "pack_members_user_id_idx" ON "pack_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "packs_blob_name_unique" ON "packs" USING btree ("blob_name");--> statement-breakpoint
CREATE INDEX "packs_status_retention_idx" ON "packs" USING btree ("status","retention_days");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_upload_item_unique" ON "receipts" USING btree ("upload_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_receipt_hash_unique" ON "receipts" USING btree ("receipt_hash");--> statement-breakpoint
CREATE INDEX "receipts_user_pack_idx" ON "receipts" USING btree ("user_id","pack_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "upload_batches_user_id_idempotency_unique" ON "upload_batches" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "upload_batches_user_status_idx" ON "upload_batches" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "upload_items_batch_local_unique" ON "upload_items" USING btree ("batch_id","local_id_hash");--> statement-breakpoint
CREATE INDEX "upload_items_pack_queue_idx" ON "upload_items" USING btree ("strategy","retention_days","status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_wallet_address_hash_unique" ON "users" USING btree ("wallet_address_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "users_owner_fingerprint_unique" ON "users" USING btree ("owner_fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "vault_public_keys_owner_fingerprint_unique" ON "vault_public_keys" USING btree ("owner_fingerprint");--> statement-breakpoint
CREATE INDEX "vault_public_keys_user_id_idx" ON "vault_public_keys" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_challenges_nonce_hash_unique" ON "wallet_challenges" USING btree ("nonce_hash");--> statement-breakpoint
CREATE INDEX "wallet_challenges_wallet_address_hash_idx" ON "wallet_challenges" USING btree ("wallet_address_hash");