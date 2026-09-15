import { db } from '@/lib/db'
import { trips, transactions, incomes } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { toAmount } from '@/lib/utils/currency'
import { getDekForUser } from '@/lib/crypto/keys'
import { decryptField } from '@/lib/crypto/fields'
import { getGoalsWithProgress } from './goals'

// Lista leve para popular o TripPicker — sem agregação de totais
export async function getActiveTrips(userId: string) {
  const dek = await getDekForUser(userId)
  const rows = await db.query.trips.findMany({ where: eq(trips.userId, userId) })
  return rows
    .map((r) => ({ id: r.id, name: decryptField(r.name, dek) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

export type TripSummary = {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
  goalId: string | null
  goalName: string | null
  goalBalance: number | null
  totalSpent: number
}

export async function getTrips(userId: string): Promise<TripSummary[]> {
  const dek = await getDekForUser(userId)

  const allTrips = await db.query.trips.findMany({ where: eq(trips.userId, userId) })
  if (allTrips.length === 0) return []

  const tripIds = allTrips.map((t) => t.id)
  const hasGoalLink = allTrips.some((t) => t.goalId !== null)

  const [txRows, goalsProgress] = await Promise.all([
    db
      .select({ tripId: transactions.tripId, amount: transactions.amount })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), inArray(transactions.tripId, tripIds))),
    hasGoalLink ? getGoalsWithProgress(userId) : Promise.resolve([]),
  ])

  const spentByTrip = new Map<string, number>()
  for (const r of txRows) {
    if (!r.tripId) continue
    const prev = spentByTrip.get(r.tripId) ?? 0
    spentByTrip.set(r.tripId, prev + toAmount(decryptField(r.amount, dek)))
  }

  const goalById = new Map(goalsProgress.map((g) => [g.id, g]))

  return allTrips
    .map((trip) => {
      const goal = trip.goalId ? goalById.get(trip.goalId) : undefined
      return {
        id: trip.id,
        name: decryptField(trip.name, dek),
        startDate: trip.startDate,
        endDate: trip.endDate,
        goalId: trip.goalId,
        goalName: goal?.name ?? null,
        goalBalance: goal?.currentBalance ?? null,
        totalSpent: spentByTrip.get(trip.id) ?? 0,
      }
    })
    .sort((a, b) => {
      if (a.startDate && b.startDate) return b.startDate.localeCompare(a.startDate)
      if (a.startDate) return -1
      if (b.startDate) return 1
      return a.name.localeCompare(b.name, 'pt-BR')
    })
}

export type TripDetailTransaction = {
  id: string
  name: string
  amount: number
  date: string
  categoryId: string | null
  categoryName: string | null
}

export type TripDetailIncome = {
  id: string
  source: string
  amount: number
  referenceMonth: string
}

export type TripDetail = {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
  goalId: string | null
  goalName: string | null
  goalBalance: number | null
  totalSpent: number
  totalIncome: number
  categoryBreakdown: Array<{ categoryId: string; categoryName: string; amount: number }>
  transactions: TripDetailTransaction[]
  incomes: TripDetailIncome[]
}

export async function getTripDetail(userId: string, tripId: string): Promise<TripDetail | null> {
  const dek = await getDekForUser(userId)

  const [trip, txRows, incomeRows] = await Promise.all([
    db.query.trips.findFirst({
      where: and(eq(trips.id, tripId), eq(trips.userId, userId)),
    }),
    db.query.transactions.findMany({
      where: and(eq(transactions.tripId, tripId), eq(transactions.userId, userId)),
      with: { category: true },
      orderBy: (t, { desc }) => [desc(t.date)],
    }),
    db.query.incomes.findMany({
      where: and(eq(incomes.tripId, tripId), eq(incomes.userId, userId)),
      orderBy: (i, { desc }) => [desc(i.referenceMonth)],
    }),
  ])

  if (!trip) return null

  const decryptedTransactions: TripDetailTransaction[] = txRows.map((t) => ({
    id: t.id,
    name: decryptField(t.name, dek),
    amount: toAmount(decryptField(t.amount, dek)),
    date: t.date,
    categoryId: t.categoryId,
    categoryName: t.category ? decryptField(t.category.name, dek) : null,
  }))

  const decryptedIncomes: TripDetailIncome[] = incomeRows.map((i) => ({
    id: i.id,
    source: decryptField(i.source, dek),
    amount: toAmount(decryptField(i.amount, dek)),
    referenceMonth: i.referenceMonth,
  }))

  const totalSpent = decryptedTransactions.reduce((sum, t) => sum + t.amount, 0)
  const totalIncome = decryptedIncomes.reduce((sum, i) => sum + i.amount, 0)

  const categoryMap = new Map<string, { categoryName: string; amount: number }>()
  for (const t of decryptedTransactions) {
    if (!t.categoryId) continue
    const prev = categoryMap.get(t.categoryId) ?? {
      categoryName: t.categoryName ?? '',
      amount: 0,
    }
    categoryMap.set(t.categoryId, {
      categoryName: prev.categoryName,
      amount: prev.amount + t.amount,
    })
  }
  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([categoryId, v]) => ({ categoryId, categoryName: v.categoryName, amount: v.amount }))
    .sort((a, b) => b.amount - a.amount)

  let goalName: string | null = null
  let goalBalance: number | null = null
  if (trip.goalId) {
    const goalsProgress = await getGoalsWithProgress(userId)
    const goal = goalsProgress.find((g) => g.id === trip.goalId)
    if (goal) {
      goalName = goal.name
      goalBalance = goal.currentBalance
    }
  }

  return {
    id: trip.id,
    name: decryptField(trip.name, dek),
    startDate: trip.startDate,
    endDate: trip.endDate,
    goalId: trip.goalId,
    goalName,
    goalBalance,
    totalSpent,
    totalIncome,
    categoryBreakdown,
    transactions: decryptedTransactions,
    incomes: decryptedIncomes,
  }
}
