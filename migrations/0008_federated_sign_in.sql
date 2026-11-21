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
ALTER TABLE "federated_account_links" ADD CONSTRAINT "federated_account_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "federated_account_links_identity_hash_unique" ON "federated_account_links" USING btree ("identity_hash");--> statement-breakpoint
CREATE INDEX "federated_account_links_user_id_index" ON "federated_account_links" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "federated_sign_in_flows_state_hash_unique" ON "federated_sign_in_flows" USING btree ("state_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "federated_sign_in_flows_receipt_hash_unique" ON "federated_sign_in_flows" USING btree ("receipt_hash");--> statement-breakpoint
CREATE INDEX "federated_sign_in_flows_expires_at_index" ON "federated_sign_in_flows" USING btree ("expires_at","id");