ALTER TABLE "users" ADD COLUMN "sign_up_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_sign_up_count_check" CHECK ("users"."sign_up_count" >= 1);--> statement-breakpoint
-- Added by hand. Backfill of the accepted sign-ups of the accounts that exist before this migration:
-- until now nothing but a sign-up and the verification changed an account, each with the next
-- version, so an unverified account was signed up `version` times and a verified one
-- `version - 1` times. Without it, a pending account replaced before this migration would count one
-- sign-up and stay verifiable by its code alone. Only the accounts signed up more than once are
-- rewritten, a small set; the others keep the default of 1. No table of this migration gains an
-- organization, so no row-level security statement is added (see 0001).
UPDATE "users"
SET "sign_up_count" = CASE WHEN "email_verified_at" IS NULL THEN "version" ELSE "version" - 1 END
WHERE ("email_verified_at" IS NULL AND "version" > 1)
  OR ("email_verified_at" IS NOT NULL AND "version" > 2);
