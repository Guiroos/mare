import { db } from '@/lib/db'
import { transactions, installmentGroups } from '@/lib/db/schema'
import { eq, and, isNotNull } from 'drizzle-orm'
import { currentReferenceMonth, futureNMonths } from '@/lib/utils/date'

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
      const totalAmount = Number(group.totalAmount)
      const totalInstallments = group.totalInstallments
      const installmentAmount = totalAmount / totalInstallments

      const paidInstallments = group.transactions.filter(
        (t) => t.referenceMonth <= currentMonthStr
      ).length

      const remainingInstallments = totalInstallments - paidInstallments
      const remainingAmount = remainingInstallments * installmentAmount

      return {
        id: group.id,
        name: group.name,
        categoryId: group.categoryId,
        accountId: group.accountId,
        accountName: group.account.name,
        categoryName: group.category.name,
        totalAmount,
        totalInstallments,
        paidInstallments,
        remainingInstallments,
        installmentAmount,
        remainingAmount,
        startDate: group.startDate,
      }
    })
    .filter((g) => g.remainingInstallments > 0)
}

// ─── Linha do tempo de parcelas (próximos 12 meses) ───────────────────────────

export async function getInstallmentTimeline(userId: string) {
  const months = futureNMonths(12)
  const currentMonthStr = months[0]
  const lastMonthStr = months[months.length - 1]

  const rows = await db.query.transactions.findMany({
    where: and(eq(transactions.userId, userId), isNotNull(transactions.installmentGroupId)),
    with: {
      installmentGroup: true,
    },
  })

  // Filter to transactions within the 12-month window
  const filtered = rows.filter(
    (t) => t.referenceMonth >= currentMonthStr && t.referenceMonth <= lastMonthStr
  )

  // Group by referenceMonth
  const monthMap = new Map<string, { name: string; amount: number }[]>()
  for (const t of filtered) {
    const month = t.referenceMonth.slice(0, 7) // YYYY-MM
    const list = monthMap.get(month) ?? []
    list.push({
      name: t.installmentGroup?.name ?? t.name,
      amount: Number(t.amount),
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
