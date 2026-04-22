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
  const [incomesResult, transactionsResult, fixedExpensesResult, investmentsResult] =
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
        .select({ total: sum(fixedExpenses.amount) })
        .from(fixedExpenses)
        .where(
          and(
            eq(fixedExpenses.userId, userId),
            eq(fixedExpenses.referenceMonth, referenceMonth)
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
  const totalExpenses =
    Number(transactionsResult[0]?.total ?? 0) +
    Number(fixedExpensesResult[0]?.total ?? 0);
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

  const [spentByCategory, fixedByCategory] = await Promise.all([
    db
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
      .groupBy(transactions.categoryId),
    db
      .select({
        categoryId: fixedExpenses.categoryId,
        total: sum(fixedExpenses.amount),
      })
      .from(fixedExpenses)
      .where(
        and(
          eq(fixedExpenses.userId, userId),
          eq(fixedExpenses.referenceMonth, referenceMonth)
        )
      )
      .groupBy(fixedExpenses.categoryId),
  ]);

  const spentMap = new Map<string, number>();
  for (const r of spentByCategory) {
    spentMap.set(r.categoryId, (spentMap.get(r.categoryId) ?? 0) + Number(r.total ?? 0));
  }
  for (const r of fixedByCategory) {
    spentMap.set(r.categoryId, (spentMap.get(r.categoryId) ?? 0) + Number(r.total ?? 0));
  }

  return groups.map((group) => {
    const categoryDetails = group.categories.map((cat) => {
      const override = cat.budgetOverrides[0];
      const budget = Number(override?.amount ?? cat.defaultBudget ?? 0);
      const spent = spentMap.get(cat.id) ?? 0;
      return { id: cat.id, name: cat.name, color: cat.color ?? undefined, bgColor: cat.bgColor ?? undefined, budget, spent };
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
  const [summary, groupProgress, monthTransactions, fixedExpenseList, incomeList, investmentList, monthlyEvolutionData] =
    await Promise.all([
      getMonthSummary(userId, referenceMonth),
      getCategoryGroupProgress(userId, referenceMonth),
      getMonthTransactions(userId, referenceMonth),
      getMonthFixedExpenses(userId, referenceMonth),
      getMonthIncomes(userId, referenceMonth),
      getMonthInvestments(userId, referenceMonth),
      getMonthlyEvolution(userId),
    ]);

  const totalBudget = groupProgress.reduce((s, g) => s + g.totalBudget, 0);
  const totalSpent = groupProgress.reduce((s, g) => s + g.totalSpent, 0);

  return {
    summary: { ...summary, totalBudget, totalSpent },
    groupProgress,
    transactions: monthTransactions,
    fixedExpenses: fixedExpenseList,
    incomes: incomeList,
    investments: investmentList,
    monthlyEvolution: monthlyEvolutionData,
  };
}

// ─── Evolução mensal (últimos N meses) ────────────────────────────────────────

export async function getMonthlyEvolution(userId: string, monthsBack: number = 6) {
  const today = new Date();

  // Build list of the last N months (oldest first) as YYYY-MM-01 strings
  const months: string[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    months.push(`${year}-${String(month).padStart(2, '0')}-01`);
  }

  const results = await Promise.all(
    months.map(async (referenceMonth) => {
      const [incomesResult, transactionsResult, fixedExpensesResult, investmentsResult] =
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
            .select({ total: sum(fixedExpenses.amount) })
            .from(fixedExpenses)
            .where(
              and(
                eq(fixedExpenses.userId, userId),
                eq(fixedExpenses.referenceMonth, referenceMonth)
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

      return {
        month: referenceMonth.slice(0, 7), // YYYY-MM
        totalIncomes: Number(incomesResult[0]?.total ?? 0),
        totalExpenses:
          Number(transactionsResult[0]?.total ?? 0) +
          Number(fixedExpensesResult[0]?.total ?? 0),
        totalInvested: Number(investmentsResult[0]?.total ?? 0),
      };
    })
  );

  return results;
}
