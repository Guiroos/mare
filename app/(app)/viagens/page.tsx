import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getTrips } from '@/lib/queries/trips'
import { getGoalsWithProgress } from '@/lib/queries/goals'
import { TripDialog } from '@/components/trips/TripDialog'
import { TripsList } from '@/components/trips/TripsList'
import { PageLayout } from '@/components/ui/page-layout'
import { PageHeader } from '@/components/ui/page-header'

export default async function ViagensPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const userId = session.user.id

  const [trips, goalsData] = await Promise.all([getTrips(userId), getGoalsWithProgress(userId)])

  const goalOptions = goalsData.map((g) => ({ id: g.id, name: g.name }))

  return (
    <PageLayout>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Viagens"
          description="Agrupe gastos e caixinhas de investimento em torno de um evento ou projeto maior."
        />
        <div className="hidden items-center gap-2 lg:flex">
          <TripDialog mode="create" goals={goalOptions} triggerSize="md" triggerVariant="primary" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-label font-semibold text-text-secondary">Suas viagens</h2>
          <div className="lg:hidden">
            <TripDialog mode="create" goals={goalOptions} />
          </div>
        </div>

        <TripsList trips={trips} goals={goalOptions} />
      </div>
    </PageLayout>
  )
}
