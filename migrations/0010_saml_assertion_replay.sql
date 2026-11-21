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
CREATE UNIQUE INDEX "saml_assertion_replays_scope_key_unique" ON "saml_assertion_replays" USING btree ("organization_id","connection_id","key_hash");--> statement-breakpoint
CREATE INDEX "saml_assertion_replays_scope_expiry_index" ON "saml_assertion_replays" USING btree ("organization_id","connection_id","expires_at");--> statement-breakpoint
CREATE POLICY "saml_assertion_replays_organization_isolation" ON "saml_assertion_replays" AS PERMISSIVE FOR ALL TO public USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid or current_setting('app.system_access', true) = 'on') WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid or current_setting('app.system_access', true) = 'on');
--> statement-breakpoint
ALTER TABLE "saml_assertion_replays" FORCE ROW LEVEL SECURITY;
