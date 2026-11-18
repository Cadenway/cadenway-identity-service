CREATE TABLE "email_changes" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_links" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"replaced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_requests" (
	"email" text PRIMARY KEY NOT NULL,
	"last_requested_at" timestamp with time zone,
	"window_started_at" timestamp with time zone,
	"window_requests" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_requests_window_requests_check" CHECK ("password_reset_requests"."window_requests" between 0 and 5)
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_changed_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "delete_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deletion_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "signed_in_at" timestamp with time zone DEFAULT date_trunc('milliseconds', now()) NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "authenticated_at" timestamp with time zone;--> statement-breakpoint
-- Added by hand. Backfill of the columns that the default sets to the time of this migration for
-- the rows that exist before it: `password_changed_at` takes the last write of the credential (the
-- sign-up, or a later sign-up of the pending account), and `signed_in_at` the creation of the
-- session, to the millisecond like the instants the service writes, so the cursor of the list of
-- the sessions compares exactly. The migrator runs every file in one transaction, so a batch would
-- not release its locks: the statements stay single and run once. Only the sessions that are not
-- revoked or expired are rewritten, the only ones the service lists, so the work grows with the open
-- sessions and not with the history; a closed session keeps the time of this migration. A row the
-- running version inserts meanwhile takes the defaults, the time of its insert. `authenticated_at`
-- stays empty: a session opened before asks for the password again before a guarded route. No table
-- of this migration gains an organization, so no row-level security statement is added (see 0001).
UPDATE "users"
SET "password_changed_at" = "password_credentials"."updated_at"
FROM "password_credentials"
WHERE "password_credentials"."user_id" = "users"."id";--> statement-breakpoint
UPDATE "sessions" SET "signed_in_at" = date_trunc('milliseconds', "created_at")
WHERE "revoked_at" IS NULL AND "expires_at" > now();--> statement-breakpoint
ALTER TABLE "email_changes" ADD CONSTRAINT "email_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_links" ADD CONSTRAINT "password_reset_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_links_token_hash_unique" ON "password_reset_links" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_links_current_unique" ON "password_reset_links" USING btree ("user_id") WHERE "password_reset_links"."used_at" is null and "password_reset_links"."replaced_at" is null;--> statement-breakpoint
CREATE INDEX "users_delete_at_index" ON "users" USING btree ("delete_at") WHERE "users"."delete_at" is not null;--> statement-breakpoint
CREATE INDEX "api_tokens_user_id_index" ON "api_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memberships_user_id_index" ON "memberships" USING btree ("user_id");