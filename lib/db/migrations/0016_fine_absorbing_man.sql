ALTER TABLE "people" ADD COLUMN "share_token_hash" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "share_token" text;--> statement-breakpoint
CREATE UNIQUE INDEX "people_share_token_hash_idx" ON "people" USING btree ("share_token_hash");