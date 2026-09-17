import { db } from '@/lib/db'
import { trips, transactions, incomes, investmentWithdrawals } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { toAmount } from '@/lib/utils/currency'
import { getDekForUser } from '@/lib/crypto/keys'
import { decryptField, decryptOptional } from '@/lib/crypto/fields'
import { getGoalsWithProgress, GoalWithProgress } from './goals'

// Lista leve para popular o TripPicker — sem agregação de totais
export async function getActiveTrips(userId: string) {
  const dek = await getDekForUser(userId)
  const rows = await db.query.trips.findMany({ where: eq(trips.userId, userId) })
  return rows
    .map((r) => ({ id: r.id, name: decryptField(r.name, dek) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

// Resgates cuja entrada foi marcada com a viagem. O vínculo mora na entrada
// (investmentWithdrawals.incomeId → incomes.tripId), não no resgate — por isso só
// resgates com destino "caixa" aparecem aqui.
function selectTripWithdrawals(userId: string, tripIds: string[]) {
  return db
    .select({
      tripId: incomes.tripId,
      incomeId: incomes.id,
      investmentTypeId: investmentWithdrawals.investmentTypeId,
      amount: investmentWithdrawals.amount,
      taxAmount: investmentWithdrawals.taxAmount,
    })
    .from(investmentWithdrawals)
    .innerJoin(incomes, eq(investmentWithdrawals.incomeId, incomes.id))
    .where(
      and(
        eq(investmentWithdrawals.userId, userId),
        eq(incomes.userId, userId),
        inArray(incomes.tripId, tripIds)
      )
    )
}

type TripWithdrawal = { investmentTypeId: string; net: number; tax: number }

function decryptTripWithdrawal(
  r: Awaited<ReturnType<typeof selectTripWithdrawals>>[number],
  dek: Buffer
): TripWithdrawal {
  return {
    investmentTypeId: r.investmentTypeId,
    // amount é líquido; o saldo da caixinha caiu pelo bruto (amount + taxAmount)
    net: toAmount(decryptField(r.amount, dek)),
    tax: toAmount(decryptOptional(r.taxAmount, dek)),
  }
}

type TripFunding = {
  goalName: string | null
  goalBalance: number | null
  goalSaved: number | null
  totalWithdrawn: number
  withdrawnTax: number
}

// "Guardado para a viagem" = saldo atual da caixinha + o que já saiu dela para a
// viagem. Resgates para outros fins continuam descontados: esse dinheiro deixou de
// estar disponível. Só resgates do mesmo tipo da meta voltam para a conta — resgate
// de outro investimento marcado com a viagem entra em "Resgatado", não no guardado.
function summarizeTripFunding(
  withdrawals: TripWithdrawal[],
  goal: GoalWithProgress | undefined
): TripFunding {
  const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.net, 0)
  const withdrawnTax = withdrawals.reduce((sum, w) => sum + w.tax, 0)

  if (!goal) {
    return { goalName: null, goalBalance: null, goalSaved: null, totalWithdrawn, withdrawnTax }
  }

  const withdrawnFromGoal = withdrawals
    .filter((w) => goal.investmentTypeId !== null && w.investmentTypeId === goal.investmentTypeId)
    .reduce((sum, w) => sum + w.net + w.tax, 0)

  return {
    goalName: goal.name,
    goalBalance: goal.currentBalance,
    goalSaved: goal.currentBalance + withdrawnFromGoal,
    totalWithdrawn,
    withdrawnTax,
  }
}

export type TripSummary = {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
  goalId: string | null
  goalName: string | null
  goalBalance: number | null
  goalSaved: number | null
  totalWithdrawn: number
  totalSpent: number
}

export async function getTrips(userId: string): Promise<TripSummary[]> {
  const dek = await getDekForUser(userId)

  const allTrips = await db.query.trips.findMany({ where: eq(trips.userId, userId) })
  if (allTrips.length === 0) return []

  const tripIds = allTrips.map((t) => t.id)
  const hasGoalLink = allTrips.some((t) => t.goalId !== null)

  const [txRows, withdrawalRows, goalsProgress] = await Promise.all([
    db
      .select({ tripId: transactions.tripId, amount: transactions.amount })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), inArray(transactions.tripId, tripIds))),
    selectTripWithdrawals(userId, tripIds),
    hasGoalLink ? getGoalsWithProgress(userId) : Promise.resolve([]),
  ])

  const spentByTrip = new Map<string, number>()
  for (const r of txRows) {
    if (!r.tripId) continue
    const prev = spentByTrip.get(r.tripId) ?? 0
    spentByTrip.set(r.tripId, prev + toAmount(decryptField(r.amount, dek)))
  }

  const withdrawalsByTrip = new Map<string, TripWithdrawal[]>()
  for (const r of withdrawalRows) {
    if (!r.tripId) continue
    const list = withdrawalsByTrip.get(r.tripId) ?? []
    list.push(decryptTripWithdrawal(r, dek))
    withdrawalsByTrip.set(r.tripId, list)
  }

  const goalById = new Map(goalsProgress.map((g) => [g.id, g]))

  return allTrips
    .map((trip) => {
      const goal = trip.goalId ? goalById.get(trip.goalId) : undefined
      const funding = summarizeTripFunding(withdrawalsByTrip.get(trip.id) ?? [], goal)
      return {
        id: trip.id,
        name: decryptField(trip.name, dek),
        startDate: trip.startDate,
        endDate: trip.endDate,
        goalId: trip.goalId,
        goalName: funding.goalName,
        goalBalance: funding.goalBalance,
        goalSaved: funding.goalSaved,
        totalWithdrawn: funding.totalWithdrawn,
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
  fromWithdrawal: boolean
}

export type TripDetail = {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
  goalId: string | null
  goalName: string | null
  goalBalance: number | null
  goalSaved: number | null
  totalSpent: number
  /** Entradas que não vieram de resgate (reembolso, rateio...) — resgates ficam em totalWithdrawn */
  totalIncome: number
  totalWithdrawn: number
  withdrawnTax: number
  categoryBreakdown: Array<{ categoryId: string; categoryName: string; amount: number }>
  transactions: TripDetailTransaction[]
  incomes: TripDetailIncome[]
}

export async function getTripDetail(userId: string, tripId: string): Promise<TripDetail | null> {
  const dek = await getDekForUser(userId)

  const [trip, txRows, incomeRows, withdrawalRows] = await Promise.all([
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
    selectTripWithdrawals(userId, [tripId]),
  ])

  if (!trip) return null

  const withdrawalIncomeIds = new Set(withdrawalRows.map((r) => r.incomeId))

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
    fromWithdrawal: withdrawalIncomeIds.has(i.id),
  }))

  const totalSpent = decryptedTransactions.reduce((sum, t) => sum + t.amount, 0)
  const totalIncome = decryptedIncomes
    .filter((i) => !i.fromWithdrawal)
    .reduce((sum, i) => sum + i.amount, 0)

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

  const goal = trip.goalId
    ? (await getGoalsWithProgress(userId)).find((g) => g.id === trip.goalId)
    : undefined
  const funding = summarizeTripFunding(
    withdrawalRows.map((r) => decryptTripWithdrawal(r, dek)),
    goal
  )

  return {
    id: trip.id,
    name: decryptField(trip.name, dek),
    startDate: trip.startDate,
    endDate: trip.endDate,
    goalId: trip.goalId,
    goalName: funding.goalName,
    goalBalance: funding.goalBalance,
    goalSaved: funding.goalSaved,
    totalSpent,
    totalIncome,
    totalWithdrawn: funding.totalWithdrawn,
    withdrawnTax: funding.withdrawnTax,
    categoryBreakdown,
    transactions: decryptedTransactions,
    incomes: decryptedIncomes,
  }
}
