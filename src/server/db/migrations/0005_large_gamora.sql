CREATE TYPE "public"."vault_upload_status" AS ENUM('reserved', 'registering', 'uploading', 'settled', 'failed', 'refunded', 'expired');--> statement-breakpoint
CREATE TABLE "vault_upload_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"upload_batch_id" uuid,
	"request_id" text NOT NULL,
	"user_address" text NOT NULL,
	"contract_address" text NOT NULL,
	"status" "vault_upload_status" NOT NULL,
	"encrypted_size_bytes" bigint NOT NULL,
	"retention_days" "retention_cohort" NOT NULL,
	"mode" "pack_strategy" NOT NULL,
	"estimated_shelby_fee_octas" bigint NOT NULL,
	"estimated_storage_fee_octas" bigint NOT NULL,
	"platform_fee_octas" bigint NOT NULL,
	"safety_buffer_octas" bigint NOT NULL,
	"total_locked_octas" bigint NOT NULL,
	"actual_shelby_cost_octas" bigint,
	"refundable_octas" bigint DEFAULT 0 NOT NULL,
	"transaction_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vault_upload_requests" ADD CONSTRAINT "vault_upload_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_upload_requests" ADD CONSTRAINT "vault_upload_requests_upload_batch_id_upload_batches_id_fk" FOREIGN KEY ("upload_batch_id") REFERENCES "public"."upload_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vault_upload_requests_request_id_unique" ON "vault_upload_requests" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "vault_upload_requests_user_status_idx" ON "vault_upload_requests" USING btree ("user_id","status");