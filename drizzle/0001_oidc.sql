ALTER TABLE "sessions" ADD COLUMN "via_oidc" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "oidc_id_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "oidc_subject" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_oidc_subject_idx" ON "users" USING btree ("oidc_subject");