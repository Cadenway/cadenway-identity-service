CREATE TABLE "idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid,
	"key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"response_status" integer NOT NULL,
	"response_headers" jsonb NOT NULL,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_keys_organization_key_unique" UNIQUE NULLS NOT DISTINCT("organization_id","key")
);
--> statement-breakpoint
ALTER TABLE "idempotency_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "event_versions" (
	"consumer" text NOT NULL,
	"organization_id" uuid,
	"aggregate_key" text NOT NULL,
	"version" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_versions_aggregate_unique" UNIQUE NULLS NOT DISTINCT("consumer","organization_id","aggregate_key")
);
--> statement-breakpoint
ALTER TABLE "event_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_name" text NOT NULL,
	"subject" text NOT NULL,
	"stream" text NOT NULL,
	"organization_id" uuid,
	"payload" jsonb NOT NULL,
	"traceparent" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "outbox_events_status_check" CHECK ("outbox_events"."status" in ('pending', 'sent', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "processed_events" (
	"consumer" text NOT NULL,
	"event_id" uuid NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "processed_events_pkey" PRIMARY KEY("consumer","event_id")
);
--> statement-breakpoint
CREATE INDEX "idempotency_keys_expires_at_index" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "outbox_events_pending_index" ON "outbox_events" USING btree ("next_attempt_at","created_at") WHERE "outbox_events"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "outbox_events_sent_at_index" ON "outbox_events" USING btree ("sent_at") WHERE "outbox_events"."status" = 'sent';--> statement-breakpoint
CREATE INDEX "processed_events_processed_at_index" ON "processed_events" USING btree ("processed_at");--> statement-breakpoint
CREATE POLICY "idempotency_keys_organization_isolation" ON "idempotency_keys" AS PERMISSIVE FOR ALL TO public USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid or current_setting('app.system_access', true) = 'on') WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid or current_setting('app.system_access', true) = 'on');--> statement-breakpoint
CREATE POLICY "event_versions_organization_isolation" ON "event_versions" AS PERMISSIVE FOR ALL TO public USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid or current_setting('app.system_access', true) = 'on') WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid or current_setting('app.system_access', true) = 'on');--> statement-breakpoint
CREATE POLICY "outbox_events_organization_isolation" ON "outbox_events" AS PERMISSIVE FOR ALL TO public USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid or current_setting('app.system_access', true) = 'on') WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid or current_setting('app.system_access', true) = 'on');--> statement-breakpoint
-- Added by hand, as the READMEs of @cadenway/nest-messaging and @cadenway/nest-common require:
-- drizzle-kit enables row-level security but does not force it, and without FORCE the owner of a
-- table (the migrator role) would bypass its policy. processed_events holds no organization data
-- and carries no policy.
ALTER TABLE "outbox_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_versions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "idempotency_keys" FORCE ROW LEVEL SECURITY;
