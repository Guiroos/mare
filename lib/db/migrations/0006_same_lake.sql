-- Remove duplicates from investments before adding unique constraint.
-- Keeps one row per (user_id, investment_type_id, reference_month) by arbitrary id ordering.
-- No-op if there are no duplicates.
DELETE FROM "investments"
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, investment_type_id, reference_month) id
  FROM "investments"
  ORDER BY user_id, investment_type_id, reference_month, id
);--> statement-breakpoint

-- Remove duplicates from monthly_budget_overrides before adding unique constraint.
DELETE FROM "monthly_budget_overrides"
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, category_id, reference_month) id
  FROM "monthly_budget_overrides"
  ORDER BY user_id, category_id, reference_month, id
);--> statement-breakpoint

CREATE UNIQUE INDEX "investments_user_type_month_uniq" ON "investments" USING btree ("user_id","investment_type_id","reference_month");--> statement-breakpoint
CREATE UNIQUE INDEX "mbo_user_category_month_uniq" ON "monthly_budget_overrides" USING btree ("user_id","category_id","reference_month");
