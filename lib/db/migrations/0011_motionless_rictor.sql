ALTER TABLE "investment_types" ADD COLUMN "maturity_date" date;--> statement-breakpoint
ALTER TABLE "investment_types" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "investment_withdrawals" ADD COLUMN "tax_amount" numeric(10, 2);