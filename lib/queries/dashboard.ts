import { db } from '@/lib/db';
import {
  transactions,
  fixedExpenses,
  incomes,
  investments,
  categories,
  categoryGroups,
  monthlyBudgetOverrides,
  paymentAccounts,
  investmentTypes,
} from '@/lib/db/schema';
import { eq, and, sql, sum, desc } from 'drizzle-orm';

// ─── Resumo do mês ────────────────────────────────────────────────────────────

export async function getMonthSummary(userId: string, referenceMonth: string) {
  const [incomesResult, transactionsResult, investmentsResult] =
    await Promise.all([
      db
        .select({ total: sum(incomes.amount) })
        .from(incomes)
        .where(
          and(
            eq(incomes.userId, userId),
            eq(incomes.referenceMonth, referenceMonth)
          )
        ),
      db
        .select({ total: sum(transactions.amount) })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.referenceMonth, referenceMonth)
          )
        ),
      db
        .select({ total: sum(investments.amount) })
        .from(investments)
        .where(
          and(
            eq(investments.userId, userId),
            eq(investments.referenceMonth, referenceMonth)
          )
        ),
    ]);

  const totalIncomes = Number(incomesResult[0]?.total ?? 0);
  const totalExpenses = Number(transactionsResult[0]?.total ?? 0);
  const totalInvested = Number(investmentsResult[0]?.total ?? 0);
  const balance = totalIncomes - totalExpenses - totalInvested;

  return { totalIncomes, totalExpenses, totalInvested, balance };
}

// ─── Gastos por grupo de categoria ───────────────────────────────────────────

export async function getCategoryGroupProgress(
  userId: string,
  referenceMonth: string
) {
  const groups = await db.query.categoryGroups.findMany({
    where: eq(categoryGroups.userId, userId),
    with: {
      categories: {
        with: {
          budgetOverrides: {
            where: eq(monthlyBudgetOverrides.referenceMonth, referenceMonth),
          },
        },
      },
    },
  });

  const spentByCategory = await db
    .select({
      categoryId: transactions.categoryId,
      total: sum(transactions.amount),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.referenceMonth, referenceMonth)
      )
    )
    .groupBy(transactions.categoryId);

  const spentMap = new Map(
    spentByCategory.map((r) => [r.categoryId, Number(r.total ?? 0)])
  );

  return groups.map((group) => {
    const categoryDetails = group.categories.map((cat) => {
      const override = cat.budgetOverrides[0];
      const budget = Number(override?.amount ?? cat.defaultBudget ?? 0);
      const spent = spentMap.get(cat.id) ?? 0;
      return { id: cat.id, name: cat.name, budget, spent };
    });

    const totalBudget = categoryDetails.reduce((s, c) => s + c.budget, 0);
    const totalSpent = categoryDetails.reduce((s, c) => s + c.spent, 0);

    return {
      id: group.id,
      name: group.name,
      totalBudget,
      totalSpent,
      categories: categoryDetails,
    };
  });
}

// ─── Transações do mês ────────────────────────────────────────────────────────

export async function getMonthTransactions(
  userId: string,
  referenceMonth: string
) {
  return db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      eq(transactions.referenceMonth, referenceMonth)
    ),
    with: {
      category: true,
      account: true,
      installmentGroup: true,
    },
    orderBy: [desc(transactions.date)],
  });
}

// ─── Gastos fixos do mês ─────────────────────────────────────────────────────

export async function getMonthFixedExpenses(
  userId: string,
  referenceMonth: string
) {
  return db.query.fixedExpenses.findMany({
    where: and(
      eq(fixedExpenses.userId, userId),
      eq(fixedExpenses.referenceMonth, referenceMonth)
    ),
    with: {
      category: true,
      account: true,
    },
    orderBy: [fixedExpenses.dueDay],
  });
}

// ─── Entradas do mês ─────────────────────────────────────────────────────────

export async function getMonthIncomes(userId: string, referenceMonth: string) {
  return db.query.incomes.findMany({
    where: and(
      eq(incomes.userId, userId),
      eq(incomes.referenceMonth, referenceMonth)
    ),
    orderBy: [desc(incomes.referenceMonth)],
  });
}

// ─── Investimentos do mês ────────────────────────────────────────────────────

export async function getMonthInvestments(
  userId: string,
  referenceMonth: string
) {
  return db.query.investments.findMany({
    where: and(
      eq(investments.userId, userId),
      eq(investments.referenceMonth, referenceMonth)
    ),
    with: { investmentType: true },
  });
}

// ─── Dados completos do dashboard (single call) ───────────────────────────────

export async function getDashboardData(userId: string, referenceMonth: string) {
  const [summary, groupProgress, monthTransactions, fixedExpenseList, incomeList, investmentList] =
    await Promise.all([
      getMonthSummary(userId, referenceMonth),
      getCategoryGroupProgress(userId, referenceMonth),
      getMonthTransactions(userId, referenceMonth),
      getMonthFixedExpenses(userId, referenceMonth),
      getMonthIncomes(userId, referenceMonth),
      getMonthInvestments(userId, referenceMonth),
    ]);

  return {
    summary,
    groupProgress,
    transactions: monthTransactions,
    fixedExpenses: fixedExpenseList,
    incomes: incomeList,
    investments: investmentList,
  };
}
