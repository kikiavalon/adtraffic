CREATE TABLE "anthropic_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"last4" text NOT NULL,
	"verified_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "anthropic_credentials_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "approval_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"approver_id" uuid,
	"conversation_id" text,
	"action_payload" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"execution_result" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" text,
	"session_id" text,
	"event_type" text NOT NULL,
	"metadata" text NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flag_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"flag_name" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feature_flag_overrides_user_id_flag_name_unique" UNIQUE("user_id","flag_name")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"timestamp" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"scopes" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_tokens_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "pending_actions" (
	"action_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" text NOT NULL,
	"payload" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"category" text NOT NULL,
	"check_key" text NOT NULL,
	"status" text NOT NULL,
	"expected" text,
	"actual" text,
	"detail" text,
	"evidence_id" uuid,
	CONSTRAINT "qa_checks_run_id_check_key_unique" UNIQUE("run_id","check_key")
);
--> statement-breakpoint
CREATE TABLE "qa_evidence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"content_type" text NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "qa_evidence_run_id_source_key_unique" UNIQUE("run_id","source_key")
);
--> statement-breakpoint
CREATE TABLE "qa_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" text,
	"campaign_id" text,
	"advertiser_id" text,
	"trigger" text DEFAULT 'auto' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"scope" text DEFAULT '[]' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'senior' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "anthropic_credentials" ADD CONSTRAINT "anthropic_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_queue" ADD CONSTRAINT "approval_queue_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_queue" ADD CONSTRAINT "approval_queue_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flag_overrides" ADD CONSTRAINT "feature_flag_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_actions" ADD CONSTRAINT "pending_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_checks" ADD CONSTRAINT "qa_checks_run_id_qa_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."qa_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_checks" ADD CONSTRAINT "qa_checks_evidence_id_qa_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."qa_evidence"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_evidence" ADD CONSTRAINT "qa_evidence_run_id_qa_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."qa_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_runs" ADD CONSTRAINT "qa_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approval_queue_status_idx" ON "approval_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "approval_queue_requester_id_idx" ON "approval_queue" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "approval_queue_created_at_idx" ON "approval_queue" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_user_created_at_idx" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_conversation_id_idx" ON "audit_logs" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "pending_actions_user_id_idx" ON "pending_actions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pending_actions_expires_at_idx" ON "pending_actions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "qa_checks_run_id_idx" ON "qa_checks" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "qa_evidence_run_id_idx" ON "qa_evidence" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "qa_runs_user_started_idx" ON "qa_runs" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "qa_runs_conversation_id_idx" ON "qa_runs" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "qa_runs_expires_at_idx" ON "qa_runs" USING btree ("expires_at");