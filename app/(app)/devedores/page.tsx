import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getPeopleWithBalances } from '@/lib/queries/debtors'
import { PageLayout } from '@/components/ui/page-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Section } from '@/components/ui/section'
import { PersonDialog } from '@/components/devedores/PersonDialog'
import { DebtorList } from '@/components/devedores/DebtorList'
import { DebtorSummaryCards } from '@/components/devedores/DebtorSummaryCards'

export default async function DevedoresPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const people = await getPeopleWithBalances(session.user.id)

  return (
    <PageLayout>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Devedores"
          description="Acompanhe valores que outras pessoas devem a você."
        />
        <PersonDialog mode="create" />
      </div>

      <DebtorSummaryCards people={people} />

      <Section title="Pessoas">
        <DebtorList people={people} />
      </Section>
    </PageLayout>
  )
}
