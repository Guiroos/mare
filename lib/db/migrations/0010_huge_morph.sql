CREATE TABLE "user_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"credit_mode" varchar(20) DEFAULT 'accrual' NOT NULL,
	"fatura_active_from" date,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "category_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "fatura_account_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "fatura_cycle_month" date;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_settings_user_idx" ON "user_settings" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_fatura_account_id_payment_accounts_id_fk" FOREIGN KEY ("fatura_account_id") REFERENCES "public"."payment_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_fatura_unique_idx" ON "transactions" USING btree ("user_id","fatura_account_id","fatura_cycle_month") WHERE "transactions"."fatura_account_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_credit_mode_check" CHECK (
  ("credit_mode" = 'accrual' AND "fatura_active_from" IS NULL)
  OR
  ("credit_mode" = 'fatura' AND "fatura_active_from" IS NOT NULL)
);--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_fatura_category_check" CHECK (
  ("fatura_account_id" IS NULL AND "fatura_cycle_month" IS NULL AND "category_id" IS NOT NULL)
  OR
  ("fatura_account_id" IS NOT NULL AND "category_id" IS NULL AND "fatura_cycle_month" IS NOT NULL)
);