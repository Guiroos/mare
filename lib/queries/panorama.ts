import { db } from '@/lib/db';
import {
  transactions,
  fixedExpenses,
  incomes,
  investments,
  categories,
  categoryGroups,
} from '@/lib/db/schema';
import { eq, and, sum, gte, lte } from 'drizzle-orm';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function yearMonths(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    return `${year}-${String(month).padStart(2, '0')}-01`;
  });
}

// ─── Visão geral anual ────────────────────────────────────────────────────────

export async function getAnnualOverview(userId: string, year: number) {
  const months = yearMonths(year);

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

      const totalIncomes = Number(incomesResult[0]?.total ?? 0);
      const totalExpenses =
        Number(transactionsResult[0]?.total ?? 0) +
        Number(fixedExpensesResult[0]?.total ?? 0);
      const totalInvested = Number(investmentsResult[0]?.total ?? 0);
      const balance = totalIncomes - totalExpenses - totalInvested;

      return {
        month: referenceMonth.slice(0, 7), // YYYY-MM
        totalIncomes,
        totalExpenses,
        totalInvested,
        balance,
      };
    })
  );

  return results;
}

// ─── Gastos anuais por grupo de categoria ─────────────────────────────────────

export async function getAnnualExpensesByGroup(userId: string, year: number) {
  const firstMonth = `${year}-01-01`;
  const lastMonth = `${year}-12-01`;

  // Fetch all category groups with their categories in one query
  const groups = await db.query.categoryGroups.findMany({
    where: eq(categoryGroups.userId, userId),
    with: { categories: true },
  });

  // Build a map: categoryId → { groupId, groupName }
  const categoryToGroup = new Map<string, { groupId: string; groupName: string }>();
  for (const group of groups) {
    for (const cat of group.categories) {
      categoryToGroup.set(cat.id, { groupId: group.id, groupName: group.name });
    }
  }

  // Fetch all transactions and fixed expenses for the year in one query each
  const [allTransactions, allFixedExpenses] = await Promise.all([
    db
      .select({
        categoryId: transactions.categoryId,
        referenceMonth: transactions.referenceMonth,
        amount: transactions.amount,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.referenceMonth, firstMonth),
          lte(transactions.referenceMonth, lastMonth)
        )
      ),
    db
      .select({
        categoryId: fixedExpenses.categoryId,
        referenceMonth: fixedExpenses.referenceMonth,
        amount: fixedExpenses.amount,
      })
      .from(fixedExpenses)
      .where(
        and(
          eq(fixedExpenses.userId, userId),
          gte(fixedExpenses.referenceMonth, firstMonth),
          lte(fixedExpenses.referenceMonth, lastMonth)
        )
      ),
  ]);

  // Aggregate in memory: month → groupId → total
  const monthGroupMap = new Map<string, Map<string, { groupName: string; total: number }>>();

  for (const t of [...allTransactions, ...allFixedExpenses]) {
    const month = t.referenceMonth.slice(0, 7); // YYYY-MM
    const groupInfo = categoryToGroup.get(t.categoryId);
    if (!groupInfo) continue;

    if (!monthGroupMap.has(month)) {
      monthGroupMap.set(month, new Map());
    }
    const groupMap = monthGroupMap.get(month)!;

    const existing = groupMap.get(groupInfo.groupId) ?? {
      groupName: groupInfo.groupName,
      total: 0,
    };
    existing.total += Number(t.amount);
    groupMap.set(groupInfo.groupId, existing);
  }

  // Build output for all 12 months (include months with no transactions as empty)
  const months = yearMonths(year);
  return months.map((refMonth) => {
    const month = refMonth.slice(0, 7);
    const groupMap = monthGroupMap.get(month) ?? new Map();
    const groupEntries = Array.from(groupMap.entries()).map(([groupId, data]) => ({
      groupId,
      groupName: data.groupName,
      total: data.total,
    }));
    return { month, groups: groupEntries };
  });
}
