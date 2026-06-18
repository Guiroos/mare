import { db } from '@/lib/db'
import { transactions, installmentGroups } from '@/lib/db/schema'
import { eq, and, isNotNull, gte, lte } from 'drizzle-orm'
import { currentReferenceMonth, futureNMonths } from '@/lib/utils/date'
import { toAmount } from '@/lib/utils/currency'

// ─── Parcelas ativas (ainda com saldo futuro) ─────────────────────────────────

export async function getActiveInstallmentGroups(userId: string) {
  const currentMonthStr = currentReferenceMonth()

  const groups = await db.query.installmentGroups.findMany({
    where: eq(installmentGroups.userId, userId),
    with: {
      transactions: true,
      account: true,
      category: true,
    },
  })

  return groups
    .map((group) => {
      const totalAmount = toAmount(group.totalAmount)
      const totalInstallments = group.totalInstallments
      const installmentAmount = totalAmount / totalInstallments

      const paidInstallments = group.transactions.filter(
        (t) => t.referenceMonth < currentMonthStr
      ).length

      const remainingInstallments = totalInstallments - paidInstallments
      const remainingAmount = remainingInstallments * installmentAmount

      const nextTx = group.transactions
        .filter((t) => t.referenceMonth >= currentMonthStr)
        .sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth))[0]

      return {
        id: group.id,
        name: group.name,
        categoryId: group.categoryId,
        accountId: group.accountId,
        accountName: group.account.name,
        categoryName: group.category.name,
        categoryColor: group.category.color ?? undefined,
        startDate: group.startDate,
        nextChargeMonth: nextTx ? nextTx.referenceMonth.slice(0, 7) : null,
        nextChargeDate: nextTx?.date ?? null,
        totalAmount,
        totalInstallments,
        paidInstallments,
        remainingInstallments,
        installmentAmount,
        remainingAmount,
      }
    })
    .filter((g) => g.remainingInstallments > 0)
}

// ─── Linha do tempo de parcelas (próximos 12 meses) ───────────────────────────

export async function getInstallmentTimeline(userId: string) {
  const months = futureNMonths(12)
  const currentMonthStr = months[0]
  const lastMonthStr = months[months.length - 1]

  const rows = await db
    .select({
      referenceMonth: transactions.referenceMonth,
      amount: transactions.amount,
      groupName: installmentGroups.name,
      txName: transactions.name,
    })
    .from(transactions)
    .leftJoin(installmentGroups, eq(transactions.installmentGroupId, installmentGroups.id))
    .where(
      and(
        eq(transactions.userId, userId),
        isNotNull(transactions.installmentGroupId),
        gte(transactions.referenceMonth, currentMonthStr),
        lte(transactions.referenceMonth, lastMonthStr)
      )
    )

  // Group by referenceMonth
  const monthMap = new Map<string, { name: string; amount: number }[]>()
  for (const t of rows) {
    const month = t.referenceMonth.slice(0, 7) // YYYY-MM
    const list = monthMap.get(month) ?? []
    list.push({
      name: t.groupName ?? t.txName,
      amount: toAmount(t.amount),
    })
    monthMap.set(month, list)
  }

  return months
    .map((refMonth) => {
      const month = refMonth.slice(0, 7) // YYYY-MM
      const groups = monthMap.get(month) ?? []
      const total = groups.reduce((s, g) => s + g.amount, 0)
      return { month, total, groups }
    })
    .filter((entry) => entry.groups.length > 0)
}
