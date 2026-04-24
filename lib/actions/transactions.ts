'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { transactions, fixedExpenses, installmentGroups } from '@/lib/db/schema'
import { auth } from '@/lib/auth'
import { eq, and } from 'drizzle-orm'
import { addMonths, format, startOfMonth } from 'date-fns'
import { parseDate, dateToReferenceMonth } from '@/lib/utils/date'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function requireUserId(session: Awaited<ReturnType<typeof auth>>) {
  const userId = (session?.user as { id?: string })?.id
  if (!userId) throw new Error('Não autorizado')
  return userId
}

// ─── Gasto avulso ─────────────────────────────────────────────────────────────

export type CreateTransactionInput = {
  name: string
  amount: string
  date: string
  categoryId: string
  accountId: string
}

export async function createTransaction(data: CreateTransactionInput) {
  const session = await auth()
  const userId = requireUserId(session)

  await db.insert(transactions).values({
    userId,
    name: data.name,
    amount: data.amount,
    date: data.date,
    referenceMonth: dateToReferenceMonth(data.date),
    categoryId: data.categoryId,
    accountId: data.accountId,
  })

  revalidatePath('/dashboard')
}

// ─── Gasto fixo ───────────────────────────────────────────────────────────────

export type CreateFixedExpenseInput = {
  name: string
  amount: string
  dueDay: number
  categoryId: string
  accountId: string
  referenceMonth: string
}

export async function createFixedExpense(data: CreateFixedExpenseInput) {
  const session = await auth()
  const userId = requireUserId(session)

  await db.insert(fixedExpenses).values({
    userId,
    name: data.name,
    amount: data.amount,
    dueDay: data.dueDay,
    categoryId: data.categoryId,
    accountId: data.accountId,
    referenceMonth: data.referenceMonth,
    paid: false,
  })

  revalidatePath('/dashboard')
}

export type UpdateFixedExpenseInput = {
  id: string
  name: string
  amount: string
  dueDay: number
  categoryId: string
  accountId: string
}

export async function updateFixedExpense(data: UpdateFixedExpenseInput) {
  const session = await auth()
  const userId = requireUserId(session)

  await db
    .update(fixedExpenses)
    .set({
      name: data.name,
      amount: data.amount,
      dueDay: data.dueDay,
      categoryId: data.categoryId,
      accountId: data.accountId,
    })
    .where(and(eq(fixedExpenses.id, data.id), eq(fixedExpenses.userId, userId)))

  revalidatePath('/dashboard')
}

export async function toggleFixedExpensePaid(id: string, paid: boolean) {
  const session = await auth()
  const userId = requireUserId(session)

  await db
    .update(fixedExpenses)
    .set({ paid })
    .where(and(eq(fixedExpenses.id, id), eq(fixedExpenses.userId, userId)))

  revalidatePath('/dashboard')
  revalidatePath('/configuracao-mes')
}

export async function deleteFixedExpense(id: string) {
  const session = await auth()
  const userId = requireUserId(session)

  await db
    .delete(fixedExpenses)
    .where(and(eq(fixedExpenses.id, id), eq(fixedExpenses.userId, userId)))

  revalidatePath('/dashboard')
}

// ─── Compra parcelada ─────────────────────────────────────────────────────────

export type CreateInstallmentInput = {
  name: string
  totalAmount: string
  totalInstallments: number
  startDate: string
  categoryId: string
  accountId: string
}

export async function createInstallmentPurchase(data: CreateInstallmentInput) {
  const session = await auth()
  const userId = requireUserId(session)

  const installmentAmount = (parseFloat(data.totalAmount) / data.totalInstallments).toFixed(2)

  const [group] = await db
    .insert(installmentGroups)
    .values({
      userId,
      name: data.name,
      totalAmount: data.totalAmount,
      totalInstallments: data.totalInstallments,
      startDate: data.startDate,
      categoryId: data.categoryId,
      accountId: data.accountId,
    })
    .returning({ id: installmentGroups.id })

  const installmentRows = Array.from({ length: data.totalInstallments }, (_, i) => {
    const installmentDate = addMonths(parseDate(data.startDate), i)
    const dateStr = format(installmentDate, 'yyyy-MM-dd')
    return {
      userId,
      name: `${data.name} (${i + 1}/${data.totalInstallments})`,
      amount: installmentAmount,
      date: dateStr,
      referenceMonth: format(startOfMonth(installmentDate), 'yyyy-MM-dd'),
      categoryId: data.categoryId,
      accountId: data.accountId,
      installmentGroupId: group.id,
      installmentNumber: i + 1,
      totalInstallments: data.totalInstallments,
    }
  })

  await db.insert(transactions).values(installmentRows)

  revalidatePath('/dashboard')
}

// ─── Edição de transação avulsa ───────────────────────────────────────────────

export type UpdateTransactionInput = {
  id: string
  name: string
  amount: string
  date: string
  categoryId: string
  accountId: string
}

export async function updateTransaction(data: UpdateTransactionInput) {
  const session = await auth()
  const userId = requireUserId(session)

  await db
    .update(transactions)
    .set({
      name: data.name,
      amount: data.amount,
      date: data.date,
      referenceMonth: dateToReferenceMonth(data.date),
      categoryId: data.categoryId,
      accountId: data.accountId,
    })
    .where(and(eq(transactions.id, data.id), eq(transactions.userId, userId)))

  revalidatePath('/dashboard')
}

// ─── Edição de compra parcelada ───────────────────────────────────────────────

export type UpdateInstallmentGroupInput = {
  id: string
  name: string
  categoryId: string
  accountId: string
}

export async function updateInstallmentGroup(data: UpdateInstallmentGroupInput) {
  const session = await auth()
  const userId = requireUserId(session)

  // Fetch group to get totalInstallments for renaming transactions
  const [group] = await db
    .select({ totalInstallments: installmentGroups.totalInstallments })
    .from(installmentGroups)
    .where(and(eq(installmentGroups.id, data.id), eq(installmentGroups.userId, userId)))

  if (!group) throw new Error('Grupo não encontrado')

  await db
    .update(installmentGroups)
    .set({ name: data.name, categoryId: data.categoryId, accountId: data.accountId })
    .where(and(eq(installmentGroups.id, data.id), eq(installmentGroups.userId, userId)))

  // Update all child transactions: rename and sync category/account
  const childTransactions = await db
    .select({ id: transactions.id, installmentNumber: transactions.installmentNumber })
    .from(transactions)
    .where(and(eq(transactions.installmentGroupId, data.id), eq(transactions.userId, userId)))

  await Promise.all(
    childTransactions.map((t) =>
      db
        .update(transactions)
        .set({
          name: `${data.name} (${t.installmentNumber}/${group.totalInstallments})`,
          categoryId: data.categoryId,
          accountId: data.accountId,
        })
        .where(and(eq(transactions.id, t.id), eq(transactions.userId, userId)))
    )
  )

  revalidatePath('/dashboard')
  revalidatePath('/parcelas')
}

// ─── Exclusão de transação avulsa ─────────────────────────────────────────────

export async function deleteTransaction(id: string) {
  const session = await auth()
  const userId = requireUserId(session)

  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)))

  revalidatePath('/dashboard')
}
