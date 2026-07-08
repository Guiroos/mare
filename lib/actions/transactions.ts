'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import {
  transactions,
  fixedExpenses,
  installmentGroups,
  paymentAccounts,
  debtorEntries,
} from '@/lib/db/schema'
import { eq, and, asc, inArray } from 'drizzle-orm'
import { addMonths, format } from 'date-fns'
import {
  parseDate,
  dateToReferenceMonth,
  calcBaseReferenceMonth,
  calcInstallmentDate,
} from '@/lib/utils/date'
import { requireUserId } from '@/lib/auth/require-user'
import {
  assertOwnsCategory,
  assertOwnsPaymentAccount,
  assertOwnsPerson,
} from '@/lib/auth/ownership'
import {
  transactionSchema,
  updateTransactionActionSchema,
  createFixedExpenseActionSchema,
  updateFixedExpenseActionSchema,
  createInstallmentActionSchema,
  updateInstallmentGroupActionSchema,
} from '@/lib/validations/transactions'
import { referenceMonthSchema } from '@/lib/validations/utils'
import { getDekForUser } from '@/lib/crypto/keys'
import { encryptField } from '@/lib/crypto/fields'

export type TransactionSplit = {
  personId: string
  amount: string
}

// ─── Gasto avulso ─────────────────────────────────────────────────────────────

export type CreateTransactionInput = {
  name: string
  amount: string
  date: string
  categoryId: string
  accountId: string
  splits?: TransactionSplit[]
}

export async function createTransaction(data: CreateTransactionInput) {
  const userId = await requireUserId()
  transactionSchema.parse(data)

  await Promise.all([
    assertOwnsCategory(userId, data.categoryId),
    assertOwnsPaymentAccount(userId, data.accountId),
    ...(data.splits ?? []).map((s) => assertOwnsPerson(userId, s.personId)),
  ])

  const dek = await getDekForUser(userId)

  await db.transaction(async (tx) => {
    const [txRow] = await tx
      .insert(transactions)
      .values({
        userId,
        name: encryptField(data.name, dek),
        amount: encryptField(data.amount, dek),
        date: data.date,
        referenceMonth: dateToReferenceMonth(data.date),
        categoryId: data.categoryId,
        accountId: data.accountId,
      })
      .returning({ id: transactions.id })

    if (data.splits && data.splits.length > 0) {
      await tx.insert(debtorEntries).values(
        data.splits.map((s) => ({
          userId,
          personId: s.personId,
          type: 'charge' as const,
          status: 'open' as const,
          amount: encryptField(s.amount, dek),
          description: encryptField(data.name, dek),
          entryDate: data.date,
          referenceMonth: dateToReferenceMonth(data.date),
          sourceTransactionId: txRow.id,
        }))
      )
    }
  })

  revalidatePath('/dashboard')
  revalidatePath('/panorama')
  if (data.splits && data.splits.length > 0) revalidatePath('/devedores')
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

  const dek = await getDekForUser(userId)

  await db.insert(fixedExpenses).values({
    userId,
    name: encryptField(data.name, dek),
    amount: encryptField(data.amount, dek),
    dueDay: data.dueDay,
    categoryId: data.categoryId,
    accountId: data.accountId,
    referenceMonth: data.referenceMonth,
    paid: false,
  })

  revalidatePath('/dashboard')
  revalidatePath('/panorama')
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

  const dek = await getDekForUser(userId)

  await db
    .update(fixedExpenses)
    .set({
      name: encryptField(data.name, dek),
      amount: encryptField(data.amount, dek),
      dueDay: data.dueDay,
      categoryId: data.categoryId,
      accountId: data.accountId,
    })
    .where(and(eq(fixedExpenses.id, data.id), eq(fixedExpenses.userId, userId)))

  revalidatePath('/dashboard')
  revalidatePath('/panorama')
}

export async function toggleFixedExpensePaid(id: string, paid: boolean) {
  const userId = await requireUserId()

  await db
    .update(fixedExpenses)
    .set({ paid })
    .where(and(eq(fixedExpenses.id, id), eq(fixedExpenses.userId, userId)))

  revalidatePath('/dashboard')
  revalidatePath('/panorama')
  revalidatePath('/configuracao-mes')
}

export async function deleteFixedExpense(id: string) {
  const userId = await requireUserId()

  await db
    .delete(fixedExpenses)
    .where(and(eq(fixedExpenses.id, id), eq(fixedExpenses.userId, userId)))

  revalidatePath('/dashboard')
  revalidatePath('/panorama')
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

  await db.transaction(async (tx) => {
    await tx
      .delete(fixedExpenses)
      .where(
        and(eq(fixedExpenses.userId, userId), eq(fixedExpenses.referenceMonth, referenceMonth))
      )

    await tx.insert(fixedExpenses).values(
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
  })

  revalidatePath('/configuracao-mes')
  revalidatePath('/dashboard')
  revalidatePath('/panorama')
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
  splits?: TransactionSplit[]
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
    ...(data.splits ?? []).map((s) => assertOwnsPerson(userId, s.personId)),
  ])

  const closingDay = accountRow?.closingDay ?? null
  const purchaseDate = parseDate(data.startDate)
  const baseReferenceMonth = calcBaseReferenceMonth(purchaseDate, closingDay)
  const installmentAmount = (parseFloat(data.totalAmount) / data.totalInstallments).toFixed(2)

  const dek = await getDekForUser(userId)

  await db.transaction(async (tx) => {
    const [group] = await tx
      .insert(installmentGroups)
      .values({
        userId,
        name: encryptField(data.name, dek),
        totalAmount: encryptField(data.totalAmount, dek),
        totalInstallments: data.totalInstallments,
        startDate: data.startDate,
        categoryId: data.categoryId,
        accountId: data.accountId,
      })
      .returning({ id: installmentGroups.id })

    const installmentRows = Array.from({ length: data.totalInstallments }, (_, i) => {
      const refMonth = addMonths(baseReferenceMonth, i)
      const date = i === 0 ? purchaseDate : calcInstallmentDate(refMonth, closingDay)
      const installmentName = `${data.name} (${i + 1}/${data.totalInstallments})`
      return {
        userId,
        name: encryptField(installmentName, dek),
        amount: encryptField(installmentAmount, dek),
        date: format(date, 'yyyy-MM-dd'),
        referenceMonth: format(refMonth, 'yyyy-MM-dd'),
        categoryId: data.categoryId,
        accountId: data.accountId,
        installmentGroupId: group.id,
        installmentNumber: i + 1,
        totalInstallments: data.totalInstallments,
      }
    })

    const txRows = await tx
      .insert(transactions)
      .values(installmentRows)
      .returning({ id: transactions.id, installmentNumber: transactions.installmentNumber })

    if (data.splits && data.splits.length > 0) {
      const splits = data.splits
      // Pre-compute per-installment amounts with last-installment rounding compensation
      const splitAmounts = splits.map((s) => {
        const total = parseFloat(s.amount)
        const perInstallment = parseFloat((total / data.totalInstallments).toFixed(2))
        const last = parseFloat((total - perInstallment * (data.totalInstallments - 1)).toFixed(2))
        return { s, perInstallment: perInstallment.toFixed(2), last: last.toFixed(2) }
      })
      const lastInstallmentNumber = data.totalInstallments
      const chargeRows = txRows.flatMap((txRow) => {
        const offset = (txRow.installmentNumber ?? 1) - 1
        const refMonth = addMonths(baseReferenceMonth, offset)
        const date = offset === 0 ? purchaseDate : calcInstallmentDate(refMonth, closingDay)
        const entryDate = format(date, 'yyyy-MM-dd')
        const referenceMonth = format(refMonth, 'yyyy-MM-dd')
        const isLast = txRow.installmentNumber === lastInstallmentNumber
        return splitAmounts.map(({ s, perInstallment, last }) => ({
          userId,
          personId: s.personId,
          type: 'charge' as const,
          status: 'open' as const,
          amount: encryptField(isLast ? last : perInstallment, dek),
          description: encryptField(
            `${data.name} (${txRow.installmentNumber}/${data.totalInstallments})`,
            dek
          ),
          entryDate,
          referenceMonth,
          sourceTransactionId: txRow.id,
        }))
      })
      await tx.insert(debtorEntries).values(chargeRows)
    }
  })

  revalidatePath('/dashboard')
  revalidatePath('/panorama')
  if (data.splits && data.splits.length > 0) revalidatePath('/devedores')
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

  const dek = await getDekForUser(userId)

  await db
    .update(transactions)
    .set({
      name: encryptField(data.name, dek),
      amount: encryptField(data.amount, dek),
      date: data.date,
      referenceMonth: dateToReferenceMonth(data.date),
      categoryId: data.categoryId,
      accountId: data.accountId,
    })
    .where(and(eq(transactions.id, data.id), eq(transactions.userId, userId)))

  revalidatePath('/dashboard')
  revalidatePath('/panorama')
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

  const dek = await getDekForUser(userId)

  const groupUpdate: Record<string, unknown> = {
    name: encryptField(data.name, dek),
    categoryId: data.categoryId,
    accountId: data.accountId,
  }
  if (data.newTotalAmount) groupUpdate.totalAmount = encryptField(data.newTotalAmount, dek)

  await db.transaction(async (tx) => {
    await tx
      .update(installmentGroups)
      .set(groupUpdate)
      .where(and(eq(installmentGroups.id, data.id), eq(installmentGroups.userId, userId)))

    const childTransactions = await tx
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
        tx
          .update(transactions)
          .set({
            name: encryptField(
              `${data.name} (${t.installmentNumber}/${group.totalInstallments})`,
              dek
            ),
            categoryId: data.categoryId,
            accountId: data.accountId,
            ...(amountUpdates[t.id] ? { amount: encryptField(amountUpdates[t.id], dek) } : {}),
          })
          .where(and(eq(transactions.id, t.id), eq(transactions.userId, userId)))
      )
    )
  })

  revalidatePath('/dashboard')
  revalidatePath('/panorama')
  revalidatePath('/parcelas')
}

export async function deleteInstallmentGroup(id: string) {
  const userId = await requireUserId()

  // Transações são deletadas antes do grupo na mesma transação atômica.
  // O FK installmentGroupId tem onDelete: 'set null' no schema, mas a semântica
  // de produto é excluir a compra inteira — grupo + parcelas.
  await db.transaction(async (tx) => {
    const txIds = await tx
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.installmentGroupId, id), eq(transactions.userId, userId)))

    if (txIds.length > 0) {
      await tx.delete(debtorEntries).where(
        inArray(
          debtorEntries.sourceTransactionId,
          txIds.map((r) => r.id)
        )
      )
    }

    await tx
      .delete(transactions)
      .where(and(eq(transactions.installmentGroupId, id), eq(transactions.userId, userId)))

    await tx
      .delete(installmentGroups)
      .where(and(eq(installmentGroups.id, id), eq(installmentGroups.userId, userId)))
  })

  revalidatePath('/parcelas')
  revalidatePath('/dashboard')
  revalidatePath('/panorama')
  revalidatePath('/devedores')
}

// ─── Exclusão de transação avulsa ─────────────────────────────────────────────

export async function deleteTransaction(id: string) {
  const userId = await requireUserId()

  await db.transaction(async (tx) => {
    await tx.delete(debtorEntries).where(eq(debtorEntries.sourceTransactionId, id))
    await tx
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
  })

  revalidatePath('/dashboard')
  revalidatePath('/panorama')
  revalidatePath('/devedores')
}
