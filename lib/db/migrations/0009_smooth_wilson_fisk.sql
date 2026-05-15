ALTER TABLE "debtor_entries" ADD COLUMN "status" varchar(20);--> statement-breakpoint
ALTER TABLE "debtor_entries" ADD COLUMN "settled_by_payment_id" uuid;--> statement-breakpoint
ALTER TABLE "debtor_entries" ADD CONSTRAINT "debtor_entries_settled_by_payment_id_debtor_entries_id_fk" FOREIGN KEY ("settled_by_payment_id") REFERENCES "public"."debtor_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "debtor_entries_settled_by_idx" ON "debtor_entries" USING btree ("settled_by_payment_id");--> statement-breakpoint
UPDATE "debtor_entries" SET "status" = 'open' WHERE "type" = 'charge';