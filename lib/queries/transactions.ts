import { db } from '@/lib/db'
import { transactions, fixedExpenses } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { getDekForUser } from '@/lib/crypto/keys'
import { decryptField } from '@/lib/crypto/fields'

// ─── Transações do mês (com decrypt) ─────────────────────────────────────────

export async function getTransactions(userId: string, referenceMonth: string) {
  const rows = await db.query.transactions.findMany({
    where: and(eq(transactions.userId, userId), eq(transactions.referenceMonth, referenceMonth)),
    with: { category: true, account: true, installmentGroup: true },
    orderBy: [desc(transactions.date)],
  })
  const dek = await getDekForUser(userId)
  return rows.map((row) => ({
    ...row,
    name: decryptField(row.name, dek),
    amount: decryptField(row.amount, dek),
    installmentGroup: row.installmentGroup
      ? {
          ...row.installmentGroup,
          name: decryptField(row.installmentGroup.name, dek),
          totalAmount: decryptField(row.installmentGroup.totalAmount, dek),
        }
      : null,
  }))
}

// ─── Gastos fixos do mês (com decrypt) ───────────────────────────────────────

export async function getFixedExpenses(userId: string, referenceMonth: string) {
  const rows = await db.query.fixedExpenses.findMany({
    where: and(eq(fixedExpenses.userId, userId), eq(fixedExpenses.referenceMonth, referenceMonth)),
    with: { category: true, account: true },
    orderBy: [fixedExpenses.dueDay],
  })
  const dek = await getDekForUser(userId)
  return rows.map((row) => ({
    ...row,
    name: decryptField(row.name, dek),
    amount: decryptField(row.amount, dek),
  }))
}
