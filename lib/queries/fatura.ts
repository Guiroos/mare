import { and, between, eq, gt, inArray, gte, lt, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { fixedExpenses, paymentAccounts, transactions, userSettings } from '@/lib/db/schema'
import { toAmount } from '@/lib/utils/currency'
import { getDekForUser } from '@/lib/crypto/keys'
import { decryptField } from '@/lib/crypto/fields'
import {
  billingCycleDateRange,
  nextMonth,
  prevMonth,
  referenceMonthToYearMonth,
  todayParts,
  yearMonthToReferenceMonth,
} from '@/lib/utils/date'

export type CreditMode = 'accrual' | 'fatura'

export type UserCreditMode = {
  creditMode: CreditMode
  faturaActiveFrom: string | null
}

export type FaturaContext = {
  creditMode: CreditMode
  faturaActiveFrom: string | null
  creditAccountIds: string[]
}

export type HistoricalUnpaidCycle = {
  cycleMonth: string
  cycleStart: string
  cycleEnd: string
  total: number
  transactionTotal: number
  fixedExpenseTotal: number
}

export type FaturaState = {
  account: { id: string; name: string; closingDay: number }
  cycleStart: string
  cycleEnd: string
  cycleMonth: string
  total: number
  transactionTotal: number
  fixedExpenseTotal: number
  payment: {
    id: string
    amount: number
    date: string
    referenceMonth: string
  } | null
}

export type OpenFatura = {
  account: { id: string; name: string; closingDay: number }
  overdueCycles: HistoricalUnpaidCycle[]
  openCycle: {
    cycleMonth: string
    cycleStart: string
    cycleEnd: string
    total: number
    transactionTotal: number
    fixedExpenseTotal: number
  }
  closedCycle: {
    cycleMonth: string
    cycleStart: string
    cycleEnd: string
    total: number
    transactionTotal: number
    fixedExpenseTotal: number
    payment: {
      id: string
      amount: number
      date: string
      referenceMonth: string
    } | null
  }
}

export async function getUserCreditMode(userId: string): Promise<UserCreditMode> {
  const row = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  })
  if (!row) return { creditMode: 'accrual', faturaActiveFrom: null }
  return {
    creditMode: row.creditMode as CreditMode,
    faturaActiveFrom: row.faturaActiveFrom,
  }
}

export async function getFaturaState(
  userId: string,
  accountId: string,
  referenceMonth: string
): Promise<FaturaState | null> {
  const [account, dek] = await Promise.all([
    db.query.paymentAccounts.findFirst({
      where: and(eq(paymentAccounts.id, accountId), eq(paymentAccounts.userId, userId)),
    }),
    getDekForUser(userId),
  ])

  if (!account || account.type !== 'credit' || !account.closingDay || account.closingDay <= 1) {
    return null
  }

  const closingDay = account.closingDay
  const yearMonth = referenceMonthToYearMonth(referenceMonth)
  const range = billingCycleDateRange(yearMonth, closingDay)
  if (!range) return null

  const prevRefMonth = yearMonthToReferenceMonth(prevMonth(yearMonth))

  const [txRows, fxRows, payment] = await Promise.all([
    db
      .select({ amount: transactions.amount })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.accountId, accountId),
          between(transactions.date, range.start, range.end)
        )
      ),
    db
      .select({ amount: fixedExpenses.amount })
      .from(fixedExpenses)
      .where(
        and(
          eq(fixedExpenses.userId, userId),
          eq(fixedExpenses.accountId, accountId),
          or(
            and(
              eq(fixedExpenses.referenceMonth, prevRefMonth),
              gte(fixedExpenses.dueDay, closingDay)
            ),
            and(
              eq(fixedExpenses.referenceMonth, referenceMonth),
              lt(fixedExpenses.dueDay, closingDay)
            )
          )
        )
      ),
    db.query.transactions.findFirst({
      where: and(
        eq(transactions.userId, userId),
        eq(transactions.faturaAccountId, accountId),
        eq(transactions.faturaCycleMonth, referenceMonth)
      ),
      columns: { id: true, amount: true, date: true, referenceMonth: true },
    }),
  ])

  const transactionTotal = txRows.reduce((s, t) => s + toAmount(decryptField(t.amount, dek)), 0)
  const fixedExpenseTotal = fxRows.reduce((s, e) => s + toAmount(decryptField(e.amount, dek)), 0)

  return {
    account: { id: account.id, name: decryptField(account.name, dek), closingDay },
    cycleStart: range.start,
    cycleEnd: range.end,
    cycleMonth: referenceMonth,
    total: transactionTotal + fixedExpenseTotal,
    transactionTotal,
    fixedExpenseTotal,
    payment: payment
      ? {
          id: payment.id,
          amount: toAmount(decryptField(payment.amount, dek)),
          date: payment.date,
          referenceMonth: payment.referenceMonth,
        }
      : null,
  }
}

export async function getOpenFaturas(
  userId: string,
  faturaActiveFrom: string | null
): Promise<OpenFatura[]> {
  const [creditAccountsRaw, dek] = await Promise.all([
    db
      .select({
        id: paymentAccounts.id,
        name: paymentAccounts.name,
        closingDay: paymentAccounts.closingDay,
      })
      .from(paymentAccounts)
      .where(
        and(
          eq(paymentAccounts.userId, userId),
          eq(paymentAccounts.type, 'credit'),
          gt(paymentAccounts.closingDay, 1)
        )
      ),
    getDekForUser(userId),
  ])

  const creditAccounts = creditAccountsRaw
    .map((a) => ({ ...a, name: decryptField(a.name, dek) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  if (creditAccounts.length === 0) return []

  const { day, month, year } = todayParts()
  const todayYearMonth = `${year}-${String(month).padStart(2, '0')}`
  const faturaStartYearMonth = faturaActiveFrom ? faturaActiveFrom.slice(0, 7) : null

  const accountCycles = creditAccounts.map((account) => {
    const closingDay = account.closingDay as number

    const openYearMonth = day < closingDay ? todayYearMonth : nextMonth(todayYearMonth)
    const closedYearMonth = day < closingDay ? prevMonth(todayYearMonth) : todayYearMonth

    const openRange = billingCycleDateRange(openYearMonth, closingDay)!
    const closedRange = billingCycleDateRange(closedYearMonth, closingDay)!

    // Historical yearMonths: from faturaStart up to (not including) closedYearMonth
    const historicalYearMonths: string[] = []
    if (faturaStartYearMonth && faturaStartYearMonth < closedYearMonth) {
      let current = faturaStartYearMonth
      while (current < closedYearMonth) {
        historicalYearMonths.push(current)
        current = nextMonth(current)
      }
    }

    const historicalRanges = historicalYearMonths
      .map((ym) => {
        const range = billingCycleDateRange(ym, closingDay)
        if (!range) return null
        return {
          refMonth: yearMonthToReferenceMonth(ym),
          prevRefMonth: yearMonthToReferenceMonth(prevMonth(ym)),
          range,
        }
      })
      .filter((h): h is NonNullable<typeof h> => h !== null)

    return {
      account: { id: account.id, name: account.name, closingDay },
      openYearMonth,
      closedYearMonth,
      openCycleMonth: yearMonthToReferenceMonth(openYearMonth),
      closedCycleMonth: yearMonthToReferenceMonth(closedYearMonth),
      openRange,
      closedRange,
      historicalRanges,
    }
  })

  const accountIds = accountCycles.map((c) => c.account.id)

  const allRanges = accountCycles.flatMap((c) => [
    c.openRange,
    c.closedRange,
    ...c.historicalRanges.map((h) => h.range),
  ])
  const allDates = allRanges.flatMap((r) => [r.start, r.end])
  const minDate = allDates.reduce((a, b) => (a < b ? a : b))
  const maxDate = allDates.reduce((a, b) => (a > b ? a : b))

  const fxMonthSet = new Set(
    accountCycles.flatMap((c) => [
      yearMonthToReferenceMonth(prevMonth(c.openYearMonth)),
      c.openCycleMonth,
      yearMonthToReferenceMonth(prevMonth(c.closedYearMonth)),
      c.closedCycleMonth,
      ...c.historicalRanges.flatMap((h) => [h.prevRefMonth, h.refMonth]),
    ])
  )

  const [allTx, allFx, allPayments] = await Promise.all([
    db
      .select({
        accountId: transactions.accountId,
        amount: transactions.amount,
        date: transactions.date,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          inArray(transactions.accountId, accountIds),
          between(transactions.date, minDate, maxDate)
        )
      ),
    db
      .select({
        accountId: fixedExpenses.accountId,
        amount: fixedExpenses.amount,
        dueDay: fixedExpenses.dueDay,
        referenceMonth: fixedExpenses.referenceMonth,
      })
      .from(fixedExpenses)
      .where(
        and(
          eq(fixedExpenses.userId, userId),
          inArray(fixedExpenses.accountId, accountIds),
          inArray(fixedExpenses.referenceMonth, Array.from(fxMonthSet))
        )
      ),
    // Fetch all payments for these accounts (no cycle filter — covers all historical)
    db
      .select({
        id: transactions.id,
        faturaAccountId: transactions.faturaAccountId,
        faturaCycleMonth: transactions.faturaCycleMonth,
        amount: transactions.amount,
        date: transactions.date,
        referenceMonth: transactions.referenceMonth,
      })
      .from(transactions)
      .where(
        and(eq(transactions.userId, userId), inArray(transactions.faturaAccountId, accountIds))
      ),
  ])

  return accountCycles.map(
    ({
      account,
      openYearMonth,
      closedYearMonth,
      openCycleMonth,
      closedCycleMonth,
      openRange,
      closedRange,
      historicalRanges,
    }) => {
      const { closingDay } = account

      const openPrevRefMonth = yearMonthToReferenceMonth(prevMonth(openYearMonth))
      const openTxTotal = allTx
        .filter(
          (t) => t.accountId === account.id && t.date >= openRange.start && t.date <= openRange.end
        )
        .reduce((s, t) => s + toAmount(decryptField(t.amount, dek)), 0)
      const openFxTotal = allFx
        .filter(
          (e) =>
            e.accountId === account.id &&
            ((e.referenceMonth === openPrevRefMonth && e.dueDay >= closingDay) ||
              (e.referenceMonth === openCycleMonth && e.dueDay < closingDay))
        )
        .reduce((s, e) => s + toAmount(decryptField(e.amount, dek)), 0)

      const closedIsPreActivation = faturaActiveFrom !== null && closedCycleMonth < faturaActiveFrom

      const closedPrevRefMonth = yearMonthToReferenceMonth(prevMonth(closedYearMonth))
      const closedTxTotal = closedIsPreActivation
        ? 0
        : allTx
            .filter(
              (t) =>
                t.accountId === account.id &&
                t.date >= closedRange.start &&
                t.date <= closedRange.end
            )
            .reduce((s, t) => s + toAmount(decryptField(t.amount, dek)), 0)
      const closedFxTotal = closedIsPreActivation
        ? 0
        : allFx
            .filter(
              (e) =>
                e.accountId === account.id &&
                ((e.referenceMonth === closedPrevRefMonth && e.dueDay >= closingDay) ||
                  (e.referenceMonth === closedCycleMonth && e.dueDay < closingDay))
            )
            .reduce((s, e) => s + toAmount(decryptField(e.amount, dek)), 0)

      const rawPayment = closedIsPreActivation
        ? undefined
        : allPayments.find(
            (p) => p.faturaAccountId === account.id && p.faturaCycleMonth === closedCycleMonth
          )

      // Build set of paid cycle months for this account
      const paidCycleMonthSet = new Set(
        allPayments
          .filter((p) => p.faturaAccountId === account.id && p.faturaCycleMonth !== null)
          .map((p) => p.faturaCycleMonth as string)
      )

      // Find historical cycles that have activity but no payment
      const overdueCycles: HistoricalUnpaidCycle[] = []
      for (const { refMonth, prevRefMonth, range } of historicalRanges) {
        if (paidCycleMonthSet.has(refMonth)) continue

        const txTotal = allTx
          .filter((t) => t.accountId === account.id && t.date >= range.start && t.date <= range.end)
          .reduce((s, t) => s + toAmount(decryptField(t.amount, dek)), 0)

        const fxTotal = allFx
          .filter(
            (e) =>
              e.accountId === account.id &&
              ((e.referenceMonth === prevRefMonth && e.dueDay >= closingDay) ||
                (e.referenceMonth === refMonth && e.dueDay < closingDay))
          )
          .reduce((s, e) => s + toAmount(decryptField(e.amount, dek)), 0)

        if (txTotal + fxTotal === 0) continue

        overdueCycles.push({
          cycleMonth: refMonth,
          cycleStart: range.start,
          cycleEnd: range.end,
          total: txTotal + fxTotal,
          transactionTotal: txTotal,
          fixedExpenseTotal: fxTotal,
        })
      }

      return {
        account,
        overdueCycles,
        openCycle: {
          cycleMonth: openCycleMonth,
          cycleStart: openRange.start,
          cycleEnd: openRange.end,
          total: openTxTotal + openFxTotal,
          transactionTotal: openTxTotal,
          fixedExpenseTotal: openFxTotal,
        },
        closedCycle: {
          cycleMonth: closedCycleMonth,
          cycleStart: closedRange.start,
          cycleEnd: closedRange.end,
          total: closedTxTotal + closedFxTotal,
          transactionTotal: closedTxTotal,
          fixedExpenseTotal: closedFxTotal,
          payment: rawPayment
            ? {
                id: rawPayment.id,
                amount: toAmount(decryptField(rawPayment.amount, dek)),
                date: rawPayment.date,
                referenceMonth: rawPayment.referenceMonth,
              }
            : null,
        },
      }
    }
  )
}
