CREATE TABLE "realtime_tickets" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"session_version" integer NOT NULL,
	"issued_at" timestamp (3) with time zone NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"redeemed_at" timestamp (3) with time zone,
	CONSTRAINT "realtime_tickets_token_hash_check" CHECK ("realtime_tickets"."token_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "realtime_tickets_session_version_check" CHECK ("realtime_tickets"."session_version" >= 1),
	CONSTRAINT "realtime_tickets_lifetime_check" CHECK ("realtime_tickets"."expires_at" > "realtime_tickets"."issued_at" and "realtime_tickets"."expires_at" <= "realtime_tickets"."issued_at" + interval '60 seconds'),
	CONSTRAINT "realtime_tickets_redeemed_at_check" CHECK ("realtime_tickets"."redeemed_at" is null or ("realtime_tickets"."redeemed_at" >= "realtime_tickets"."issued_at" and "realtime_tickets"."redeemed_at" < "realtime_tickets"."expires_at"))
);
--> statement-breakpoint
ALTER TABLE "realtime_tickets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "realtime_tickets" ADD CONSTRAINT "realtime_tickets_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "realtime_tickets_session_id_index" ON "realtime_tickets" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "realtime_tickets_expiry_index" ON "realtime_tickets" USING btree ("expires_at","token_hash");--> statement-breakpoint
CREATE POLICY "realtime_tickets_organization_isolation" ON "realtime_tickets" AS PERMISSIVE FOR ALL TO public USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid or current_setting('app.system_access', true) = 'on') WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid or current_setting('app.system_access', true) = 'on');--> statement-breakpoint
ALTER TABLE "realtime_tickets" FORCE ROW LEVEL SECURITY;
