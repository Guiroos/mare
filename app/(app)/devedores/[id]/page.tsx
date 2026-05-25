import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import {
  getPersonDebtDetails,
  getTransactionsForDebtLink,
  getOpenChargesForPerson,
} from '@/lib/queries/debtors'
import { PageLayout } from '@/components/ui/page-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Section } from '@/components/ui/section'
import { PersonDialog } from '@/components/devedores/PersonDialog'
import { DebtChargeDialog } from '@/components/devedores/DebtChargeDialog'
import { DebtPaymentDialog } from '@/components/devedores/DebtPaymentDialog'
import { DebtEntryList } from '@/components/devedores/DebtEntryList'
import { DebtorDetailSummary } from '@/components/devedores/DebtorDetailSummary'
import { DebtBalanceEvolutionChart } from '@/components/devedores/DebtBalanceEvolutionChart'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function DevedorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [session, { id }] = await Promise.all([auth(), params])
  if (!session) redirect('/login')
  const [data, txForLink, openCharges] = await Promise.all([
    getPersonDebtDetails(session.user.id, id),
    getTransactionsForDebtLink(session.user.id),
    getOpenChargesForPerson(session.user.id, id),
  ])
  if (!data) notFound()

  const { person, summary, balanceEvolution, entries } = data

  return (
    <PageLayout>
      <Link
        href="/devedores"
        className="flex w-fit items-center gap-1.5 text-small text-text-tertiary hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Devedores
      </Link>

      <div className="flex items-start justify-between gap-4">
        <PageHeader title={person.name} description={person.email ?? person.phone ?? undefined} />
        <PersonDialog mode="edit" person={person} balance={summary.balance} />
      </div>

      <DebtorDetailSummary summary={summary} hasEntries={entries.length > 0} />

      <div className="flex gap-2">
        <DebtChargeDialog personId={person.id} transactions={txForLink} />
        <DebtPaymentDialog personId={person.id} openCharges={openCharges} />
      </div>

      <Section title="Evolução do saldo">
        <DebtBalanceEvolutionChart data={balanceEvolution} />
      </Section>

      <Section title="Histórico de lançamentos">
        <DebtEntryList entries={entries} personId={person.id} />
      </Section>
    </PageLayout>
  )
}
