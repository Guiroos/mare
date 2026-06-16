import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getPeopleWithBalances, getOpenChargesForPeople } from '@/lib/queries/debtors'
import { getUserPixKey } from '@/lib/queries/settings'
import { PageLayout } from '@/components/ui/page-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Section } from '@/components/ui/section'
import { PersonDialog } from '@/components/devedores/PersonDialog'
import { DebtorList } from '@/components/devedores/DebtorList'
import { DebtorSummaryCards } from '@/components/devedores/DebtorSummaryCards'
import { PixKeyCard } from '@/components/devedores/PixKeyCard'

export default async function DevedoresPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const [people, pixKey] = await Promise.all([
    getPeopleWithBalances(session.user.id),
    getUserPixKey(session.user.id),
  ])

  const personIds = people.map((p) => p.id)
  const openChargesByPerson = await getOpenChargesForPeople(session.user.id, personIds)

  return (
    <PageLayout>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Devedores"
          description="Acompanhe valores que outras pessoas devem a você."
        />
        <PersonDialog mode="create" />
      </div>

      <PixKeyCard pixKey={pixKey} />

      <DebtorSummaryCards people={people} />

      <Section title="Pessoas">
        <DebtorList people={people} openChargesByPerson={openChargesByPerson} pixKey={pixKey} />
      </Section>
    </PageLayout>
  )
}
