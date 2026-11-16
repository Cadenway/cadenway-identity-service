-- Keep the exclusive table lock short. The deployed relay still selects only pending rows.
-- The next release validates the checks and creates the expiry index outside this transaction.
SET LOCAL lock_timeout = '2s';
--> statement-breakpoint
ALTER TABLE "public"."outbox_events"
  ADD COLUMN "lease_token" uuid,
  ADD COLUMN "lease_expires_at" timestamptz,
  DROP CONSTRAINT "outbox_events_status_check",
  ADD CONSTRAINT "outbox_events_status_check"
    CHECK ("status" IN ('pending', 'leased', 'sent', 'failed')) NOT VALID,
  ADD CONSTRAINT "outbox_events_lease_check"
    CHECK (
      ("status" = 'leased' AND "lease_token" IS NOT NULL AND "lease_expires_at" IS NOT NULL)
      OR
      ("status" <> 'leased' AND "lease_token" IS NULL AND "lease_expires_at" IS NULL)
    ) NOT VALID;
