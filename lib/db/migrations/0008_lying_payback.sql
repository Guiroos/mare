CREATE TABLE "debtor_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"description" varchar(200) NOT NULL,
	"reference_month" date NOT NULL,
	"entry_date" date NOT NULL,
	"due_date" date,
	"source_transaction_id" uuid,
	"income_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"email" varchar(255),
	"phone" varchar(40),
	"notes" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "debtor_entries" ADD CONSTRAINT "debtor_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debtor_entries" ADD CONSTRAINT "debtor_entries_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debtor_entries" ADD CONSTRAINT "debtor_entries_source_transaction_id_transactions_id_fk" FOREIGN KEY ("source_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debtor_entries" ADD CONSTRAINT "debtor_entries_income_id_incomes_id_fk" FOREIGN KEY ("income_id") REFERENCES "public"."incomes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "debtor_entries_user_person_idx" ON "debtor_entries" USING btree ("user_id","person_id");--> statement-breakpoint
CREATE INDEX "debtor_entries_user_month_idx" ON "debtor_entries" USING btree ("user_id","reference_month");