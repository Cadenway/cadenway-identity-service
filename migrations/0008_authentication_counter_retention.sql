SET LOCAL lock_timeout = '5s';--> statement-breakpoint
SET LOCAL statement_timeout = '30s';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sign_in_attempts_retention_index" ON "sign_in_attempts" USING btree ("updated_at","email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_requests_retention_index" ON "code_requests" USING btree ("updated_at","email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "password_reset_requests_retention_index" ON "password_reset_requests" USING btree ("updated_at","email");--> statement-breakpoint
SET LOCAL lock_timeout TO DEFAULT;--> statement-breakpoint
SET LOCAL statement_timeout TO DEFAULT;
