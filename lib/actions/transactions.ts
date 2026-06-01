'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { transactions, fixedExpenses, installmentGroups, paymentAccounts } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { addMonths, format } from 'date-fns'
import {
  parseDate,
  dateToReferenceMonth,
  calcBaseReferenceMonth,
  calcInstallmentDate,
} from '@/lib/utils/date'
import { requireUserId } from '@/lib/auth/require-user'
import { assertOwnsCategory, assertOwnsPaymentAccount } from '@/lib/auth/ownership'
import {
  transactionSchema,
  updateTransactionActionSchema,
  createFixedExpenseActionSchema,
  updateFixedExpenseActionSchema,
  createInstallmentActionSchema,
  updateInstallmentGroupActionSchema,
} from '@/lib/validations/transactions'
import { referenceMonthSchema } from '@/lib/validations/utils'

// ─── Gasto avulso ─────────────────────────────────────────────────────────────

export type CreateTransactionInput = {
  name: string
  amount: string
  date: string
  categoryId: string
  accountId: string
}

export async function createTransaction(data: CreateTransactionInput) {
  const userId = await requireUserId()
  transactionSchema.parse(data)

  await Promise.all([
    assertOwnsCategory(userId, data.categoryId),
    assertOwnsPaymentAccount(userId, data.accountId),
  ])

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
  const userId = await requireUserId()
  createFixedExpenseActionSchema.parse(data)

  await Promise.all([
    assertOwnsCategory(userId, data.categoryId),
    assertOwnsPaymentAccount(userId, data.accountId),
  ])

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
  const userId = await requireUserId()
  updateFixedExpenseActionSchema.parse(data)

  await Promise.all([
    assertOwnsCategory(userId, data.categoryId),
    assertOwnsPaymentAccount(userId, data.accountId),
  ])

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
  const userId = await requireUserId()

  await db
    .update(fixedExpenses)
    .set({ paid })
    .where(and(eq(fixedExpenses.id, id), eq(fixedExpenses.userId, userId)))

  revalidatePath('/dashboard')
  revalidatePath('/configuracao-mes')
}

export async function deleteFixedExpense(id: string) {
  const userId = await requireUserId()

  await db
    .delete(fixedExpenses)
    .where(and(eq(fixedExpenses.id, id), eq(fixedExpenses.userId, userId)))

  revalidatePath('/dashboard')
}

export async function copyFixedExpensesFromPrevMonth(
  referenceMonth: string,
  prevReferenceMonth: string
) {
  const userId = await requireUserId()
  referenceMonthSchema.parse(referenceMonth)
  referenceMonthSchema.parse(prevReferenceMonth)

  const prevExpenses = await db.query.fixedExpenses.findMany({
    where: and(
      eq(fixedExpenses.userId, userId),
      eq(fixedExpenses.referenceMonth, prevReferenceMonth)
    ),
  })

  if (prevExpenses.length === 0) return { copied: 0 }

  await db
    .delete(fixedExpenses)
    .where(and(eq(fixedExpenses.userId, userId), eq(fixedExpenses.referenceMonth, referenceMonth)))

  await db.insert(fixedExpenses).values(
    prevExpenses.map((e) => ({
      userId,
      name: e.name,
      amount: e.amount,
      dueDay: e.dueDay,
      categoryId: e.categoryId,
      accountId: e.accountId,
      referenceMonth,
      paid: false,
    }))
  )

  revalidatePath('/configuracao-mes')
  revalidatePath('/dashboard')
  return { copied: prevExpenses.length }
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
  const userId = await requireUserId()
  createInstallmentActionSchema.parse(data)

  const [, accountRow] = await Promise.all([
    assertOwnsCategory(userId, data.categoryId),
    assertOwnsPaymentAccount(userId, data.accountId).then(() =>
      db
        .select({ closingDay: paymentAccounts.closingDay })
        .from(paymentAccounts)
        .where(eq(paymentAccounts.id, data.accountId))
        .then((rows) => rows[0])
    ),
  ])

  const closingDay = accountRow?.closingDay ?? null
  const purchaseDate = parseDate(data.startDate)
  const baseReferenceMonth = calcBaseReferenceMonth(purchaseDate, closingDay)
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
    const refMonth = addMonths(baseReferenceMonth, i)
    const date = i === 0 ? purchaseDate : calcInstallmentDate(refMonth, closingDay)
    return {
      userId,
      name: `${data.name} (${i + 1}/${data.totalInstallments})`,
      amount: installmentAmount,
      date: format(date, 'yyyy-MM-dd'),
      referenceMonth: format(refMonth, 'yyyy-MM-dd'),
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
  const userId = await requireUserId()
  updateTransactionActionSchema.parse(data)

  await Promise.all([
    assertOwnsCategory(userId, data.categoryId),
    assertOwnsPaymentAccount(userId, data.accountId),
  ])

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
  newTotalAmount?: string
}

export async function updateInstallmentGroup(data: UpdateInstallmentGroupInput) {
  const userId = await requireUserId()
  updateInstallmentGroupActionSchema.parse(data)

  // Fetch do grupo e ownership checks em paralelo para não adicionar latência
  const [rows] = await Promise.all([
    db
      .select({ totalInstallments: installmentGroups.totalInstallments })
      .from(installmentGroups)
      .where(and(eq(installmentGroups.id, data.id), eq(installmentGroups.userId, userId))),
    assertOwnsCategory(userId, data.categoryId),
    assertOwnsPaymentAccount(userId, data.accountId),
  ])

  const group = rows[0]
  if (!group) throw new Error('Grupo não encontrado')

  const groupUpdate: Record<string, unknown> = {
    name: data.name,
    categoryId: data.categoryId,
    accountId: data.accountId,
  }
  if (data.newTotalAmount) groupUpdate.totalAmount = data.newTotalAmount

  await db
    .update(installmentGroups)
    .set(groupUpdate)
    .where(and(eq(installmentGroups.id, data.id), eq(installmentGroups.userId, userId)))

  const childTransactions = await db
    .select({ id: transactions.id, installmentNumber: transactions.installmentNumber })
    .from(transactions)
    .where(and(eq(transactions.installmentGroupId, data.id), eq(transactions.userId, userId)))
    .orderBy(asc(transactions.installmentNumber))

  // Recalculate amounts for all installments, last one absorbs rounding
  const amountUpdates: Record<string, string> = {}
  if (data.newTotalAmount) {
    const totalCents = Math.round(parseFloat(data.newTotalAmount) * 100)
    const n = childTransactions.length
    const baseCents = Math.floor(totalCents / n)
    const remainderCents = totalCents - baseCents * n
    childTransactions.forEach((t, i) => {
      const cents = baseCents + (i === n - 1 ? remainderCents : 0)
      amountUpdates[t.id] = (cents / 100).toFixed(2)
    })
  }

  await Promise.all(
    childTransactions.map((t) =>
      db
        .update(transactions)
        .set({
          name: `${data.name} (${t.installmentNumber}/${group.totalInstallments})`,
          categoryId: data.categoryId,
          accountId: data.accountId,
          ...(amountUpdates[t.id] ? { amount: amountUpdates[t.id] } : {}),
        })
        .where(and(eq(transactions.id, t.id), eq(transactions.userId, userId)))
    )
  )

  revalidatePath('/dashboard')
  revalidatePath('/parcelas')
}

export async function deleteInstallmentGroup(id: string) {
  const userId = await requireUserId()

  // Transações são deletadas antes do grupo na mesma transação atômica.
  // O FK installmentGroupId tem onDelete: 'set null' no schema, mas a semântica
  // de produto é excluir a compra inteira — grupo + parcelas.
  await db.transaction(async (tx) => {
    await tx
      .delete(transactions)
      .where(and(eq(transactions.installmentGroupId, id), eq(transactions.userId, userId)))

    await tx
      .delete(installmentGroups)
      .where(and(eq(installmentGroups.id, id), eq(installmentGroups.userId, userId)))
  })

  revalidatePath('/parcelas')
  revalidatePath('/dashboard')
}

// ─── Exclusão de transação avulsa ─────────────────────────────────────────────

export async function deleteTransaction(id: string) {
  const userId = await requireUserId()

  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)))

  revalidatePath('/dashboard')
}
