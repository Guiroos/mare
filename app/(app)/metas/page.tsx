import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getGoalsWithProgress, getInvestmentTypesForGoals } from '@/lib/queries/goals'
import { GoalDialog } from '@/components/metas/GoalDialog'
import { MetasList } from '@/components/metas/MetasList'
import { PrivacyToggle } from '@/components/providers/PrivacyMode'
import { PageLayout } from '@/components/ui/page-layout'
import { PageHeader } from '@/components/ui/page-header'

export default async function MetasPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const userId = session.user.id

  const [goalsData, investmentTypes] = await Promise.all([
    getGoalsWithProgress(userId),
    getInvestmentTypesForGoals(userId),
  ])

  const investmentTypeOptions = investmentTypes.map((t) => ({ id: t.id, name: t.name }))

  return (
    <PageLayout>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Metas" description="Acompanhe o progresso das suas metas financeiras." />
        <PrivacyToggle />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-label font-semibold text-text-secondary">Suas metas</h2>
          <GoalDialog mode="create" investmentTypes={investmentTypeOptions} />
        </div>

        <MetasList goals={goalsData} investmentTypeOptions={investmentTypeOptions} />
      </div>
    </PageLayout>
  )
}
