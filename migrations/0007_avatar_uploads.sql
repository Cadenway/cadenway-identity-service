CREATE TABLE "avatar_uploads" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"generation" integer NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"idempotency_digest" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "avatar_uploads_generation_check" CHECK ("avatar_uploads"."generation" >= 0),
	CONSTRAINT "avatar_uploads_size_check" CHECK ("avatar_uploads"."size_bytes" between 1 and 5242880),
	CONSTRAINT "avatar_uploads_content_type_check" CHECK ("avatar_uploads"."content_type" in ('image/png', 'image/jpeg', 'image/webp')),
	CONSTRAINT "avatar_uploads_status_check" CHECK ("avatar_uploads"."status" in ('pending', 'committed', 'expired', 'superseded'))
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_generation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "avatar_uploads" ADD CONSTRAINT "avatar_uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "avatar_uploads_user_idempotency_unique" ON "avatar_uploads" USING btree ("user_id","idempotency_digest");--> statement-breakpoint
CREATE INDEX "avatar_uploads_expiry_index" ON "avatar_uploads" USING btree ("expires_at","user_id","id") WHERE "avatar_uploads"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_generation_check" CHECK ("users"."avatar_generation" >= 0);