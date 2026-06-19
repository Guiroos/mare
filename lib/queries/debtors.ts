import { db } from '@/lib/db'
import { people, debtorEntries, transactions, categories, paymentAccounts } from '@/lib/db/schema'
import { eq, and, desc, asc, gte, inArray, or, isNull } from 'drizzle-orm'
import { toAmount } from '@/lib/utils/currency'
import { getDekForUser } from '@/lib/crypto/keys'
import { decryptField, decryptOptional } from '@/lib/crypto/fields'

export type PersonWithBalance = {
  id: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  archived: boolean
  balance: number
  lastMovement: string | null
}

export async function getPeopleWithBalances(userId: string): Promise<PersonWithBalance[]> {
  const [personRows, entryRows, dek] = await Promise.all([
    db
      .select({
        id: people.id,
        name: people.name,
        email: people.email,
        phone: people.phone,
        notes: people.notes,
        archived: people.archived,
      })
      .from(people)
      .where(and(eq(people.userId, userId), eq(people.archived, false))),
    db
      .select({
        personId: debtorEntries.personId,
        type: debtorEntries.type,
        amount: debtorEntries.amount,
        entryDate: debtorEntries.entryDate,
      })
      .from(debtorEntries)
      .where(eq(debtorEntries.userId, userId)),
    getDekForUser(userId),
  ])

  const balanceMap: Record<string, number> = {}
  const lastMovementMap: Record<string, string | null> = {}

  for (const e of entryRows) {
    const amount = toAmount(decryptField(e.amount, dek))
    if (balanceMap[e.personId] === undefined) balanceMap[e.personId] = 0
    if (e.type === 'payment') {
      balanceMap[e.personId] -= amount
    } else {
      balanceMap[e.personId] += amount
    }
    if (!lastMovementMap[e.personId] || e.entryDate > lastMovementMap[e.personId]!) {
      lastMovementMap[e.personId] = e.entryDate
    }
  }

  const result = personRows.map((r) => ({
    id: r.id,
    name: decryptField(r.name, dek),
    email: decryptOptional(r.email, dek),
    phone: decryptOptional(r.phone, dek),
    notes: decryptOptional(r.notes, dek),
    archived: r.archived,
    balance: balanceMap[r.id] ?? 0,
    lastMovement: lastMovementMap[r.id] ?? null,
  }))

  result.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  return result
}

export type ActivePerson = { id: string; name: string }

export async function getActivePeople(userId: string): Promise<ActivePerson[]> {
  const [rows, dek] = await Promise.all([
    db
      .select({ id: people.id, name: people.name })
      .from(people)
      .where(and(eq(people.userId, userId), eq(people.archived, false)))
      .orderBy(asc(people.name)),
    getDekForUser(userId),
  ])

  return rows.map((r) => ({
    id: r.id,
    name: decryptField(r.name, dek),
  }))
}

export type DebtEntryDetail = {
  id: string
  type: 'charge' | 'payment' | 'adjustment'
  amount: number
  description: string
  referenceMonth: string
  entryDate: string
  notes: string | null
  incomeId: string | null
  status: string | null
  settledByPaymentId: string | null
  settledCharges: Array<{ id: string; description: string; amount: number }>
  sourceTransaction: {
    id: string
    name: string
    amount: number
    date: string
  } | null
}

export type BalanceEvolutionPoint = {
  month: string
  balance: number
}

export type PersonDebtDetails = {
  person: {
    id: string
    name: string
    email: string | null
    phone: string | null
    notes: string | null
    archived: boolean
  }
  summary: {
    balance: number
    totalCharged: number
    totalPaid: number
    lastMovement: string | null
    chargeCount: number
    paymentCount: number
  }
  balanceEvolution: BalanceEvolutionPoint[]
  entries: DebtEntryDetail[]
} | null

export async function getPersonDebtDetails(
  userId: string,
  personId: string
): Promise<PersonDebtDetails> {
  const [person, rawEntries, dek] = await Promise.all([
    db.query.people.findFirst({
      where: and(eq(people.userId, userId), eq(people.id, personId)),
    }),
    db
      .select({
        id: debtorEntries.id,
        type: debtorEntries.type,
        amount: debtorEntries.amount,
        description: debtorEntries.description,
        referenceMonth: debtorEntries.referenceMonth,
        entryDate: debtorEntries.entryDate,
        notes: debtorEntries.notes,
        incomeId: debtorEntries.incomeId,
        status: debtorEntries.status,
        settledByPaymentId: debtorEntries.settledByPaymentId,
        sourceTransactionId: debtorEntries.sourceTransactionId,
        sourceTxName: transactions.name,
        sourceTxAmount: transactions.amount,
        sourceTxDate: transactions.date,
      })
      .from(debtorEntries)
      .leftJoin(transactions, eq(debtorEntries.sourceTransactionId, transactions.id))
      .where(and(eq(debtorEntries.userId, userId), eq(debtorEntries.personId, personId)))
      .orderBy(asc(debtorEntries.entryDate), asc(debtorEntries.createdAt)),
    getDekForUser(userId),
  ])

  if (!person) return null

  // Second query: fetch settled charges grouped by the payment that settled them.
  // Only runs if there are payment entries to look up.
  const paymentIds = rawEntries.filter((e) => e.type === 'payment').map((e) => e.id)

  const settledChargesMap: Record<
    string,
    Array<{ id: string; description: string; amount: number }>
  > = {}

  if (paymentIds.length > 0) {
    const settled = await db
      .select({
        settledByPaymentId: debtorEntries.settledByPaymentId,
        id: debtorEntries.id,
        description: debtorEntries.description,
        amount: debtorEntries.amount,
      })
      .from(debtorEntries)
      .where(
        and(inArray(debtorEntries.settledByPaymentId, paymentIds), eq(debtorEntries.userId, userId))
      )

    for (const row of settled) {
      const pid = row.settledByPaymentId!
      if (!settledChargesMap[pid]) settledChargesMap[pid] = []
      settledChargesMap[pid].push({
        id: row.id,
        description: decryptField(row.description, dek),
        amount: toAmount(decryptField(row.amount, dek)),
      })
    }
  }

  const entries = rawEntries.map((e) => ({
    id: e.id,
    type: e.type as 'charge' | 'payment' | 'adjustment',
    amount: toAmount(decryptField(e.amount, dek)),
    description: decryptField(e.description, dek),
    referenceMonth: e.referenceMonth,
    entryDate: e.entryDate,
    notes: decryptOptional(e.notes, dek),
    incomeId: e.incomeId,
    status: e.status,
    settledByPaymentId: e.settledByPaymentId,
    settledCharges: settledChargesMap[e.id] ?? [],
    sourceTransaction: e.sourceTransactionId
      ? {
          id: e.sourceTransactionId,
          name: decryptField(e.sourceTxName!, dek),
          amount: toAmount(decryptField(e.sourceTxAmount!, dek)),
          date: e.sourceTxDate!,
        }
      : null,
  }))

  let balance = 0
  let totalCharged = 0
  let totalPaid = 0
  let chargeCount = 0
  let paymentCount = 0
  let lastMovement: string | null = null

  for (const e of entries) {
    if (e.type === 'payment') {
      balance -= e.amount
      totalPaid += e.amount
      paymentCount++
    } else {
      balance += e.amount
      totalCharged += e.amount
      chargeCount++
    }
    if (!lastMovement || e.entryDate > lastMovement) lastMovement = e.entryDate
  }

  // balanceEvolution: one point per month (last balance of each month), entries already asc
  const balanceEvolution: BalanceEvolutionPoint[] = []
  let runningBalance = 0
  let currentMonth = ''
  for (const e of entries) {
    if (e.type === 'payment') {
      runningBalance -= e.amount
    } else {
      runningBalance += e.amount
    }
    const month = e.entryDate.slice(0, 7)
    if (month !== currentMonth) {
      if (currentMonth) balanceEvolution.push({ month: currentMonth, balance: runningBalance })
      currentMonth = month
    } else {
      if (
        balanceEvolution.length > 0 &&
        balanceEvolution[balanceEvolution.length - 1].month === month
      ) {
        balanceEvolution[balanceEvolution.length - 1].balance = runningBalance
      }
    }
  }
  if (currentMonth) {
    const last = balanceEvolution[balanceEvolution.length - 1]
    if (!last || last.month !== currentMonth) {
      balanceEvolution.push({ month: currentMonth, balance: runningBalance })
    } else {
      last.balance = runningBalance
    }
  }

  // entries returned desc for display
  const entriesDesc = [...entries].reverse()

  return {
    person: {
      id: person.id,
      name: decryptField(person.name, dek),
      email: decryptOptional(person.email, dek),
      phone: decryptOptional(person.phone, dek),
      notes: decryptOptional(person.notes, dek),
      archived: person.archived,
    },
    summary: { balance, totalCharged, totalPaid, lastMovement, chargeCount, paymentCount },
    balanceEvolution,
    entries: entriesDesc,
  }
}

export type TransactionForDebtLink = {
  id: string
  name: string
  amount: number
  date: string
  categoryName: string
  accountName: string
}

export async function getTransactionsForDebtLink(
  userId: string
): Promise<TransactionForDebtLink[]> {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 6)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const [rows, dek] = await Promise.all([
    db
      .select({
        id: transactions.id,
        name: transactions.name,
        amount: transactions.amount,
        date: transactions.date,
        categoryName: categories.name,
        accountName: paymentAccounts.name,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .innerJoin(paymentAccounts, eq(transactions.accountId, paymentAccounts.id))
      .where(and(eq(transactions.userId, userId), gte(transactions.date, cutoffStr)))
      .orderBy(desc(transactions.date)),
    getDekForUser(userId),
  ])

  return rows.map((r) => ({
    id: r.id,
    name: decryptField(r.name, dek),
    amount: toAmount(decryptField(r.amount, dek)),
    date: r.date,
    categoryName: decryptField(r.categoryName, dek),
    accountName: decryptField(r.accountName, dek),
  }))
}

export type OpenChargeForLinking = {
  id: string
  description: string
  amount: number
  entryDate: string
}

export async function getOpenChargesForPerson(
  userId: string,
  personId: string
): Promise<OpenChargeForLinking[]> {
  const [rows, dek] = await Promise.all([
    db
      .select({
        id: debtorEntries.id,
        description: debtorEntries.description,
        amount: debtorEntries.amount,
        entryDate: debtorEntries.entryDate,
      })
      .from(debtorEntries)
      .where(
        and(
          eq(debtorEntries.userId, userId),
          eq(debtorEntries.personId, personId),
          eq(debtorEntries.type, 'charge'),
          or(eq(debtorEntries.status, 'open'), isNull(debtorEntries.status))
        )
      )
      .orderBy(asc(debtorEntries.entryDate)),
    getDekForUser(userId),
  ])

  return rows.map((r) => ({
    id: r.id,
    description: decryptField(r.description, dek),
    amount: toAmount(decryptField(r.amount, dek)),
    entryDate: r.entryDate,
  }))
}

export async function getOpenChargesForPeople(
  userId: string,
  personIds: string[]
): Promise<Record<string, OpenChargeForLinking[]>> {
  if (personIds.length === 0) return {}

  const [rows, dek] = await Promise.all([
    db
      .select({
        id: debtorEntries.id,
        personId: debtorEntries.personId,
        description: debtorEntries.description,
        amount: debtorEntries.amount,
        entryDate: debtorEntries.entryDate,
      })
      .from(debtorEntries)
      .where(
        and(
          eq(debtorEntries.userId, userId),
          inArray(debtorEntries.personId, personIds),
          eq(debtorEntries.type, 'charge'),
          or(eq(debtorEntries.status, 'open'), isNull(debtorEntries.status))
        )
      )
      .orderBy(asc(debtorEntries.entryDate)),
    getDekForUser(userId),
  ])

  const result: Record<string, OpenChargeForLinking[]> = {}
  for (const row of rows) {
    if (!result[row.personId]) result[row.personId] = []
    result[row.personId].push({
      id: row.id,
      description: decryptField(row.description, dek),
      amount: toAmount(decryptField(row.amount, dek)),
      entryDate: row.entryDate,
    })
  }
  return result
}
