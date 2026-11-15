CREATE TABLE "code_requests" (
	"email" text PRIMARY KEY NOT NULL,
	"last_requested_at" timestamp with time zone,
	"window_started_at" timestamp with time zone,
	"window_requests" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "code_requests_window_requests_check" CHECK ("code_requests"."window_requests" between 0 and 5)
);
--> statement-breakpoint
CREATE TABLE "one_time_codes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"replaced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "one_time_codes_purpose_check" CHECK ("one_time_codes"."purpose" in ('email-verification', 'sign-in', 'email-change')),
	CONSTRAINT "one_time_codes_failed_attempts_check" CHECK ("one_time_codes"."failed_attempts" between 0 and 5)
);
--> statement-breakpoint
CREATE TABLE "password_credentials" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sign_in_attempts" (
	"email" text PRIMARY KEY NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sign_in_attempts_failed_attempts_check" CHECK ("sign_in_attempts"."failed_attempts" between 0 and 5)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"language" text DEFAULT 'fr' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_version_check" CHECK ("users"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"persistent" boolean NOT NULL,
	"ip_address" text NOT NULL,
	"user_agent" text,
	"browser" text,
	"operating_system" text,
	"device_type" text,
	"last_active_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_version_check" CHECK ("sessions"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "one_time_codes" ADD CONSTRAINT "one_time_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_credentials" ADD CONSTRAINT "password_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_time_codes_current_unique" ON "one_time_codes" USING btree ("user_id","purpose") WHERE "one_time_codes"."consumed_at" is null and "one_time_codes"."replaced_at" is null;--> statement-breakpoint
CREATE INDEX "one_time_codes_user_purpose_hash_index" ON "one_time_codes" USING btree ("user_id","purpose","code_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_id_index" ON "sessions" USING btree ("user_id");
-- Added by hand. No table of this migration declares a row-level security policy, so none gets a
-- FORCE ROW LEVEL SECURITY statement: users, credentials, codes, the code throttle, the password
-- lockout and sessions carry no organization (organizationId is always null in the contracts), and
-- every query names its account, address, code or session explicitly. A table that gains an
-- organization later gets its column, policy and FORCE statement in a new migration.
