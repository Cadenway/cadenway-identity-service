ALTER TABLE "sessions" ADD COLUMN "saml_organization_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "saml_member_id" uuid;--> statement-breakpoint
-- Existing rows have both new columns null. Enforce new writes without scanning every session.
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_saml_membership_check" CHECK (("sessions"."saml_organization_id" is null) = ("sessions"."saml_member_id" is null)) NOT VALID;
