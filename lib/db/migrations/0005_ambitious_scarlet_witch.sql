CREATE INDEX "fixed_expenses_user_month_idx" ON "fixed_expenses" USING btree ("user_id","reference_month");--> statement-breakpoint
CREATE INDEX "incomes_user_month_idx" ON "incomes" USING btree ("user_id","reference_month");--> statement-breakpoint
CREATE INDEX "withdrawals_user_type_idx" ON "investment_withdrawals" USING btree ("user_id","investment_type_id");--> statement-breakpoint
CREATE INDEX "investments_user_month_idx" ON "investments" USING btree ("user_id","reference_month");--> statement-breakpoint
CREATE INDEX "investments_user_type_idx" ON "investments" USING btree ("user_id","investment_type_id");--> statement-breakpoint
CREATE INDEX "mbo_user_month_idx" ON "monthly_budget_overrides" USING btree ("user_id","reference_month");--> statement-breakpoint
CREATE INDEX "transactions_user_month_idx" ON "transactions" USING btree ("user_id","reference_month");--> statement-breakpoint
CREATE INDEX "transactions_user_date_idx" ON "transactions" USING btree ("user_id","date");