import { db } from '@/lib/db'
import { transactions, installmentGroups, paymentAccounts, categories } from '@/lib/db/schema'
import { eq, and, isNotNull, gte, lte } from 'drizzle-orm'
import { currentReferenceMonth, futureNMonths } from '@/lib/utils/date'
import { toAmount } from '@/lib/utils/currency'
import { getDekForUser } from '@/lib/crypto/keys'
import { decryptField, decryptOptional } from '@/lib/crypto/fields'

// ─── Parcelas ativas (ainda com saldo futuro) ─────────────────────────────────

export async function getActiveInstallmentGroups(userId: string) {
  const currentMonthStr = currentReferenceMonth()

  const [groups, txRows, dek] = await Promise.all([
    db
      .select({
        id: installmentGroups.id,
        name: installmentGroups.name,
        totalAmount: installmentGroups.totalAmount,
        totalInstallments: installmentGroups.totalInstallments,
        startDate: installmentGroups.startDate,
        categoryId: installmentGroups.categoryId,
        accountId: installmentGroups.accountId,
        accountName: paymentAccounts.name,
        categoryName: categories.name,
        categoryColor: categories.color,
      })
      .from(installmentGroups)
      .innerJoin(paymentAccounts, eq(installmentGroups.accountId, paymentAccounts.id))
      .innerJoin(categories, eq(installmentGroups.categoryId, categories.id))
      .where(eq(installmentGroups.userId, userId)),
    db
      .select({
        installmentGroupId: transactions.installmentGroupId,
        referenceMonth: transactions.referenceMonth,
        date: transactions.date,
      })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), isNotNull(transactions.installmentGroupId))),
    getDekForUser(userId),
  ])

  // Index transactions by group id
  const txByGroup = new Map<string, typeof txRows>()
  for (const tx of txRows) {
    const gid = tx.installmentGroupId!
    const list = txByGroup.get(gid) ?? []
    list.push(tx)
    txByGroup.set(gid, list)
  }

  return groups
    .map((group) => {
      const totalAmount = toAmount(decryptField(group.totalAmount, dek))
      const totalInstallments = group.totalInstallments
      const installmentAmount = totalAmount / totalInstallments
      const groupTxs = txByGroup.get(group.id) ?? []

      const paidInstallments = groupTxs.filter((t) => t.referenceMonth <= currentMonthStr).length

      const remainingInstallments = totalInstallments - paidInstallments
      const remainingAmount = remainingInstallments * installmentAmount

      const nextTx = groupTxs
        .filter((t) => t.referenceMonth >= currentMonthStr)
        .sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth))[0]

      return {
        id: group.id,
        name: decryptField(group.name, dek),
        categoryId: group.categoryId,
        accountId: group.accountId,
        accountName: decryptField(group.accountName, dek),
        categoryName: decryptField(group.categoryName, dek),
        categoryColor: group.categoryColor ?? undefined,
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

  const dek = await getDekForUser(userId)

  // Group by referenceMonth
  const monthMap = new Map<string, { name: string; amount: number }[]>()
  for (const t of rows) {
    const month = t.referenceMonth.slice(0, 7) // YYYY-MM
    const list = monthMap.get(month) ?? []
    const decryptedAmount = decryptField(t.amount, dek)
    const rawGroupName = decryptOptional(t.groupName, dek)
    const rawTxName = decryptField(t.txName, dek)
    list.push({
      name: rawGroupName ?? rawTxName,
      amount: toAmount(decryptedAmount),
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
