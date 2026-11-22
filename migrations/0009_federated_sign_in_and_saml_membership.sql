CREATE TABLE "federated_account_links" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"issuer" text NOT NULL,
	"subject" text NOT NULL,
	"identity_hash" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "federated_account_links_provider_check" CHECK ("federated_account_links"."provider" in ('google', 'github', 'microsoft', 'gitlab', 'saml')),
	CONSTRAINT "federated_account_links_hash_check" CHECK ("federated_account_links"."identity_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "federated_account_links_status_check" CHECK ("federated_account_links"."status" in ('active', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "federated_sign_in_flows" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"state_hash" text NOT NULL,
	"receipt_hash" text,
	"state" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "federated_sign_in_flows_state_hash_check" CHECK ("federated_sign_in_flows"."state_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "federated_sign_in_flows_receipt_hash_check" CHECK ("federated_sign_in_flows"."receipt_hash" is null or "federated_sign_in_flows"."receipt_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "federated_sign_in_flows_version_check" CHECK ("federated_sign_in_flows"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "saml_account_links" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"connection_id" text NOT NULL,
	"issuer" text NOT NULL,
	"subject" text NOT NULL,
	"identity_hash" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saml_account_links_hash_check" CHECK ("saml_account_links"."identity_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "saml_account_links_status_check" CHECK ("saml_account_links"."status" in ('active', 'revoked'))
);
--> statement-breakpoint
ALTER TABLE "saml_account_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "saml_assertion_replays" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"connection_id" text NOT NULL,
	"key_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saml_assertion_replays_key_hash_check" CHECK ("saml_assertion_replays"."key_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "saml_assertion_replays" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sign_in_challenges" ADD COLUMN "federated_binding" jsonb;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "saml_organization_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "saml_member_id" uuid;--> statement-breakpoint
ALTER TABLE "federated_account_links" ADD CONSTRAINT "federated_account_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saml_account_links" ADD CONSTRAINT "saml_account_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "federated_account_links_identity_hash_unique" ON "federated_account_links" USING btree ("identity_hash");--> statement-breakpoint
CREATE INDEX "federated_account_links_user_id_index" ON "federated_account_links" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "federated_sign_in_flows_state_hash_unique" ON "federated_sign_in_flows" USING btree ("state_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "federated_sign_in_flows_receipt_hash_unique" ON "federated_sign_in_flows" USING btree ("receipt_hash");--> statement-breakpoint
CREATE INDEX "federated_sign_in_flows_expires_at_index" ON "federated_sign_in_flows" USING btree ("expires_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "saml_account_links_scoped_identity_unique" ON "saml_account_links" USING btree ("organization_id","connection_id","identity_hash");--> statement-breakpoint
CREATE INDEX "saml_account_links_user_id_index" ON "saml_account_links" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saml_assertion_replays_scope_key_unique" ON "saml_assertion_replays" USING btree ("organization_id","connection_id","key_hash");--> statement-breakpoint
CREATE INDEX "saml_assertion_replays_scope_expiry_index" ON "saml_assertion_replays" USING btree ("organization_id","connection_id","expires_at");--> statement-breakpoint
CREATE INDEX "saml_assertion_replays_expiry_index" ON "saml_assertion_replays" USING btree ("expires_at","id");--> statement-breakpoint
-- Existing rows have both new columns null. Enforce new writes without scanning every session.
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_saml_membership_check" CHECK (("sessions"."saml_organization_id" is null) = ("sessions"."saml_member_id" is null)) NOT VALID;--> statement-breakpoint
CREATE POLICY "saml_account_links_organization_isolation" ON "saml_account_links" AS PERMISSIVE FOR ALL TO public USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid or current_setting('app.system_access', true) = 'on') WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid or current_setting('app.system_access', true) = 'on');--> statement-breakpoint
CREATE POLICY "saml_assertion_replays_organization_isolation" ON "saml_assertion_replays" AS PERMISSIVE FOR ALL TO public USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid or current_setting('app.system_access', true) = 'on') WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid or current_setting('app.system_access', true) = 'on');--> statement-breakpoint
ALTER TABLE "saml_account_links" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "saml_assertion_replays" FORCE ROW LEVEL SECURITY;
