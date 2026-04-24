import {
  pgTable,
  uuid,
  varchar,
  decimal,
  date,
  integer,
  boolean,
  timestamp,
  text,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }).unique().notNull(),
  image: varchar('image', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// NextAuth required tables
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 255 }).notNull(),
  providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: integer('expires_at'),
  tokenType: varchar('token_type', { length: 255 }),
  scope: varchar('scope', { length: 255 }),
  idToken: text('id_token'),
  sessionState: varchar('session_state', { length: 255 }),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionToken: varchar('session_token', { length: 255 }).unique().notNull(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires').notNull(),
})

export const verificationTokens = pgTable('verification_tokens', {
  identifier: varchar('identifier', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).unique().notNull(),
  expires: timestamp('expires').notNull(),
})

// Domain tables
export const categoryGroups = pgTable('category_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
})

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  groupId: uuid('group_id')
    .notNull()
    .references(() => categoryGroups.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  defaultBudget: decimal('default_budget', { precision: 10, scale: 2 }),
  color: varchar('color', { length: 7 }),
  bgColor: varchar('bg_color', { length: 7 }),
})

export const monthlyBudgetOverrides = pgTable('monthly_budget_overrides', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),
  referenceMonth: date('reference_month').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
})

export const paymentAccounts = pgTable('payment_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // credit | debit | pix
  closingDay: integer('closing_day'),
})

export const fixedExpenses = pgTable('fixed_expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id')
    .notNull()
    .references(() => paymentAccounts.id, { onDelete: 'restrict' }),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'restrict' }),
  name: varchar('name', { length: 200 }).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  dueDay: integer('due_day').notNull(),
  paid: boolean('paid').default(false).notNull(),
  referenceMonth: date('reference_month').notNull(),
})

export const installmentGroups = pgTable('installment_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id')
    .notNull()
    .references(() => paymentAccounts.id, { onDelete: 'restrict' }),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'restrict' }),
  name: varchar('name', { length: 200 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  totalInstallments: integer('total_installments').notNull(),
  startDate: date('start_date').notNull(),
})

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id')
    .notNull()
    .references(() => paymentAccounts.id, { onDelete: 'restrict' }),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'restrict' }),
  installmentGroupId: uuid('installment_group_id').references(() => installmentGroups.id, {
    onDelete: 'set null',
  }),
  name: varchar('name', { length: 200 }).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  date: date('date').notNull(),
  referenceMonth: date('reference_month').notNull(),
  installmentNumber: integer('installment_number'),
  totalInstallments: integer('total_installments'),
})

export const incomes = pgTable('incomes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  source: varchar('source', { length: 200 }).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  referenceMonth: date('reference_month').notNull(),
})

export const goals = pgTable('goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  investmentTypeId: uuid('investment_type_id'),
  name: varchar('name', { length: 200 }).notNull(),
  targetAmount: decimal('target_amount', { precision: 10, scale: 2 }).notNull(),
  targetDate: date('target_date'),
})

export const investmentTypes = pgTable('investment_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  goalId: uuid('goal_id').references(() => goals.id, { onDelete: 'set null' }),
})

export const investments = pgTable('investments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  investmentTypeId: uuid('investment_type_id')
    .notNull()
    .references(() => investmentTypes.id, { onDelete: 'restrict' }),
  amount: decimal('amount', { precision: 10, scale: 2 }),
  yieldAmount: decimal('yield_amount', { precision: 10, scale: 2 }),
  referenceMonth: date('reference_month').notNull(),
  notes: text('notes'),
})

export const investmentWithdrawals = pgTable('investment_withdrawals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  investmentTypeId: uuid('investment_type_id')
    .notNull()
    .references(() => investmentTypes.id, { onDelete: 'restrict' }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  date: date('date').notNull(),
  destination: varchar('destination', { length: 20 }).notNull(), // income | transfer
  incomeId: uuid('income_id').references(() => incomes.id, {
    onDelete: 'set null',
  }),
  notes: text('notes'),
})

export const goalContributions = pgTable('goal_contributions', {
  id: uuid('id').primaryKey().defaultRandom(),
  goalId: uuid('goal_id')
    .notNull()
    .references(() => goals.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  referenceMonth: date('reference_month').notNull(),
  source: varchar('source', { length: 20 }).notNull(), // manual | investment
})

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  categoryGroups: many(categoryGroups),
  categories: many(categories),
  paymentAccounts: many(paymentAccounts),
  fixedExpenses: many(fixedExpenses),
  installmentGroups: many(installmentGroups),
  transactions: many(transactions),
  incomes: many(incomes),
  investmentTypes: many(investmentTypes),
  investments: many(investments),
  investmentWithdrawals: many(investmentWithdrawals),
  goals: many(goals),
  goalContributions: many(goalContributions),
}))

export const categoryGroupsRelations = relations(categoryGroups, ({ one, many }) => ({
  user: one(users, { fields: [categoryGroups.userId], references: [users.id] }),
  categories: many(categories),
}))

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  group: one(categoryGroups, {
    fields: [categories.groupId],
    references: [categoryGroups.id],
  }),
  budgetOverrides: many(monthlyBudgetOverrides),
  fixedExpenses: many(fixedExpenses),
  transactions: many(transactions),
}))

export const monthlyBudgetOverridesRelations = relations(monthlyBudgetOverrides, ({ one }) => ({
  user: one(users, {
    fields: [monthlyBudgetOverrides.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [monthlyBudgetOverrides.categoryId],
    references: [categories.id],
  }),
}))

export const paymentAccountsRelations = relations(paymentAccounts, ({ one, many }) => ({
  user: one(users, {
    fields: [paymentAccounts.userId],
    references: [users.id],
  }),
  fixedExpenses: many(fixedExpenses),
  installmentGroups: many(installmentGroups),
  transactions: many(transactions),
}))

export const fixedExpensesRelations = relations(fixedExpenses, ({ one }) => ({
  user: one(users, { fields: [fixedExpenses.userId], references: [users.id] }),
  account: one(paymentAccounts, {
    fields: [fixedExpenses.accountId],
    references: [paymentAccounts.id],
  }),
  category: one(categories, {
    fields: [fixedExpenses.categoryId],
    references: [categories.id],
  }),
}))

export const installmentGroupsRelations = relations(installmentGroups, ({ one, many }) => ({
  user: one(users, {
    fields: [installmentGroups.userId],
    references: [users.id],
  }),
  account: one(paymentAccounts, {
    fields: [installmentGroups.accountId],
    references: [paymentAccounts.id],
  }),
  category: one(categories, {
    fields: [installmentGroups.categoryId],
    references: [categories.id],
  }),
  transactions: many(transactions),
}))

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  account: one(paymentAccounts, {
    fields: [transactions.accountId],
    references: [paymentAccounts.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  installmentGroup: one(installmentGroups, {
    fields: [transactions.installmentGroupId],
    references: [installmentGroups.id],
  }),
}))

export const incomesRelations = relations(incomes, ({ one }) => ({
  user: one(users, { fields: [incomes.userId], references: [users.id] }),
}))

export const goalsRelations = relations(goals, ({ one, many }) => ({
  user: one(users, { fields: [goals.userId], references: [users.id] }),
  investmentType: one(investmentTypes, {
    fields: [goals.investmentTypeId],
    references: [investmentTypes.id],
  }),
  contributions: many(goalContributions),
}))

export const investmentTypesRelations = relations(investmentTypes, ({ one, many }) => ({
  user: one(users, {
    fields: [investmentTypes.userId],
    references: [users.id],
  }),
  goal: one(goals, {
    fields: [investmentTypes.goalId],
    references: [goals.id],
  }),
  investments: many(investments),
  withdrawals: many(investmentWithdrawals),
}))

export const investmentsRelations = relations(investments, ({ one }) => ({
  user: one(users, { fields: [investments.userId], references: [users.id] }),
  investmentType: one(investmentTypes, {
    fields: [investments.investmentTypeId],
    references: [investmentTypes.id],
  }),
}))

export const investmentWithdrawalsRelations = relations(investmentWithdrawals, ({ one }) => ({
  user: one(users, {
    fields: [investmentWithdrawals.userId],
    references: [users.id],
  }),
  investmentType: one(investmentTypes, {
    fields: [investmentWithdrawals.investmentTypeId],
    references: [investmentTypes.id],
  }),
  income: one(incomes, {
    fields: [investmentWithdrawals.incomeId],
    references: [incomes.id],
  }),
}))

export const goalContributionsRelations = relations(goalContributions, ({ one }) => ({
  goal: one(goals, {
    fields: [goalContributions.goalId],
    references: [goals.id],
  }),
  user: one(users, {
    fields: [goalContributions.userId],
    references: [users.id],
  }),
}))
