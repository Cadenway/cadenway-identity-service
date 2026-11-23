ALTER TABLE "users" ADD COLUMN "deletion_attempt_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_deletion_attempt_requires_schedule" CHECK ("users"."deletion_attempt_id" is null or "users"."delete_at" is not null) NOT VALID;--> statement-breakpoint
CREATE FUNCTION "require_account_deletion_attempt"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.deletion_attempt_id IS NULL
    OR current_setting('app.account_deletion_attempt_id', true) IS DISTINCT FROM OLD.deletion_attempt_id::text
  THEN
    RAISE EXCEPTION 'A scheduled account deletion requires its confirmed attempt.' USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "users_require_account_deletion_attempt"
BEFORE DELETE ON "users"
FOR EACH ROW WHEN (OLD.delete_at IS NOT NULL)
EXECUTE FUNCTION "require_account_deletion_attempt"();
