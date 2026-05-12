ALTER TABLE "investment_types" ADD COLUMN "color" varchar(7);--> statement-breakpoint
ALTER TABLE "investment_types" ADD COLUMN "bg_color" varchar(7);--> statement-breakpoint
UPDATE "investment_types"
SET "color" = '#1a78c4',
    "bg_color" = '#e4eff8'
WHERE "color" IS NULL OR "bg_color" IS NULL;
