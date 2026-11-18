CREATE TABLE "authenticator_app_setups" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"secret" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backup_codes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_key_registrations" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"challenge" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_keys" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" bigint DEFAULT 0 NOT NULL,
	"transports" text[] DEFAULT '{}'::text[] NOT NULL,
	"backup_eligible" boolean NOT NULL,
	"backed_up" boolean NOT NULL,
	"user_verified" boolean NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "security_keys_counter_check" CHECK ("security_keys"."counter" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sign_in_challenges" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"persistent" boolean NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"assertion_challenge" text,
	"assertion_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "two_step_verifications" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"authenticator_secret" text NOT NULL,
	"authenticator_configured_at" timestamp with time zone NOT NULL,
	"last_accepted_time_step" bigint,
	"webauthn_user_handle" text NOT NULL,
	"failed_answers" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"backup_codes_generated_at" timestamp with time zone NOT NULL,
	"enabled_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "two_step_verifications_webauthn_user_handle_unique" UNIQUE("webauthn_user_handle"),
	CONSTRAINT "two_step_verifications_failed_answers_check" CHECK ("two_step_verifications"."failed_answers" between 0 and 5)
);
--> statement-breakpoint
CREATE TABLE "authentication_policies" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"two_step_verification_required_for" text DEFAULT 'nobody' NOT NULL,
	"session_inactivity_timeout_minutes" integer DEFAULT 720 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "authentication_policies_required_for_check" CHECK ("authentication_policies"."two_step_verification_required_for" in ('nobody', 'admins', 'everyone')),
	CONSTRAINT "authentication_policies_inactivity_check" CHECK ("authentication_policies"."session_inactivity_timeout_minutes" in (60, 720, 10080, 43200)),
	CONSTRAINT "authentication_policies_version_check" CHECK ("authentication_policies"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "authentication_policies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trusted_devices" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "two_step_enrollments" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"enabled_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "two_step_authenticated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "authenticator_app_setups" ADD CONSTRAINT "authenticator_app_setups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_codes" ADD CONSTRAINT "backup_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_key_registrations" ADD CONSTRAINT "security_key_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_keys" ADD CONSTRAINT "security_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sign_in_challenges" ADD CONSTRAINT "sign_in_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_step_verifications" ADD CONSTRAINT "two_step_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "backup_codes_user_hash_unique" ON "backup_codes" USING btree ("user_id","code_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "security_keys_credential_id_unique" ON "security_keys" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "security_keys_user_id_index" ON "security_keys" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sign_in_challenges_user_id_unique" ON "sign_in_challenges" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sign_in_challenges_token_hash_unique" ON "sign_in_challenges" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "trusted_devices_token_hash_unique" ON "trusted_devices" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "trusted_devices_user_id_index" ON "trusted_devices" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "authentication_policies_organization_isolation" ON "authentication_policies" AS PERMISSIVE FOR ALL TO public USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid or current_setting('app.system_access', true) = 'on') WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid or current_setting('app.system_access', true) = 'on');--> statement-breakpoint
-- Added by hand, as the READMEs of @cadenway/nest-messaging and @cadenway/nest-common require:
-- drizzle-kit enables row-level security but does not force it, and without FORCE the owner of a
-- table (the migrator role) would bypass its policy. `authentication_policies` is the only new table
-- with an organization_id. Expand-only: every statement adds a table or a nullable column, which
-- the running version neither reads nor writes, so the previous image keeps working on the
-- migrated database.
ALTER TABLE "authentication_policies" FORCE ROW LEVEL SECURITY;
