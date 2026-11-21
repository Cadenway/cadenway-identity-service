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
ALTER TABLE "saml_account_links" ADD CONSTRAINT "saml_account_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "saml_account_links_scoped_identity_unique" ON "saml_account_links" USING btree ("organization_id","connection_id","identity_hash");--> statement-breakpoint
CREATE INDEX "saml_account_links_user_id_index" ON "saml_account_links" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "saml_account_links_organization_isolation" ON "saml_account_links" AS PERMISSIVE FOR ALL TO public USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid or current_setting('app.system_access', true) = 'on') WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid or current_setting('app.system_access', true) = 'on');--> statement-breakpoint
ALTER TABLE "saml_account_links" FORCE ROW LEVEL SECURITY;
