import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getTripDetail } from '@/lib/queries/trips'
import { getGoalsWithProgress } from '@/lib/queries/goals'
import { TripDetailHeader } from '@/components/trips/TripDetailHeader'
import { TripStatCards } from '@/components/trips/TripStatCards'
import { TripCategoryBreakdown } from '@/components/trips/TripCategoryBreakdown'
import { TripEntriesList } from '@/components/trips/TripEntriesList'
import { PageLayout } from '@/components/ui/page-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Section } from '@/components/ui/section'
import { formatDisplayDate } from '@/lib/utils/date'

export default async function ViagemDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const [session, { id }] = await Promise.all([auth(), params])
  if (!session) redirect('/login')

  const userId = session.user.id

  const [trip, goalsData] = await Promise.all([
    getTripDetail(userId, id),
    getGoalsWithProgress(userId),
  ])

  if (!trip) notFound()

  const goalOptions = goalsData.map((g) => ({ id: g.id, name: g.name }))

  const period =
    trip.startDate && trip.endDate
      ? `${formatDisplayDate(trip.startDate)} – ${formatDisplayDate(trip.endDate)}`
      : (trip.startDate ?? trip.endDate)
        ? formatDisplayDate((trip.startDate ?? trip.endDate)!)
        : undefined

  return (
    <PageLayout>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title={trip.name} description={period} />
        <TripDetailHeader trip={trip} goals={goalOptions} />
      </div>

      <TripStatCards
        totalSpent={trip.totalSpent}
        totalIncome={trip.totalIncome}
        goalBalance={trip.goalBalance}
      />

      {trip.categoryBreakdown.length > 0 && (
        <Section title="Por categoria">
          <TripCategoryBreakdown categories={trip.categoryBreakdown} />
        </Section>
      )}

      <TripEntriesList transactions={trip.transactions} incomes={trip.incomes} />
    </PageLayout>
  )
}
