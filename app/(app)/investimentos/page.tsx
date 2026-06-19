import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import {
  getInvestmentBalances,
  getInvestmentTypes,
  getInvestmentWithdrawals,
  getPatrimonyTimeline,
  getArchivedCount,
} from '@/lib/queries/investments'
import { formatMonthAbbr, currentReferenceMonth, referenceMonthToYearMonth } from '@/lib/utils/date'
import { EmptyState } from '@/components/ui/empty-state'
import { Section } from '@/components/ui/section'
import { InvestmentTypeDialog } from '@/components/investimentos/InvestmentTypeDialog'
import { InvestmentEntryDialog } from '@/components/investimentos/InvestmentEntryDialog'
import { WithdrawalDialog } from '@/components/investimentos/WithdrawalDialog'
import { PatrimonyChart } from '@/components/charts/PatrimonyChart'
import { PatrimonyHero } from '@/components/investimentos/PatrimonyHero'
import { InvestmentTypeCard } from '@/components/investimentos/InvestmentTypeCard'
import { InvestmentTypeAccordion } from '@/components/investimentos/InvestmentTypeAccordion'
import { WithdrawalTable } from '@/components/investimentos/WithdrawalTable'
import { PageHeader } from '@/components/ui/page-header'
import { PageLayout } from '@/components/ui/page-layout'
import { ArchivedFilterChip } from '@/components/investimentos/ArchivedFilterChip'
import { PrivacyToggle } from '@/components/providers/PrivacyMode'

export default async function InvestimentosPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const userId = session.user.id
  const params = await searchParams
  const showArchived = params.archived === '1'

  const [balances, allTypes, withdrawals, timeline, archivedCount] = await Promise.all([
    getInvestmentBalances(userId, { showArchived }),
    getInvestmentTypes(userId),
    getInvestmentWithdrawals(userId),
    getPatrimonyTimeline(userId),
    getArchivedCount(userId),
  ])

  const investmentTypeOptions = allTypes.map((t) => ({ id: t.id, name: t.name }))

  // ── Hero stats ──────────────────────────────────────────────────────────────
  const totalPatrimony = balances.reduce((s, b) => s + b.currentBalance, 0)
  const totalAporte = balances.reduce((s, b) => s + b.totalAmount, 0)
  const totalYield = balances.reduce((s, b) => s + b.totalYield, 0)

  const currentRefMonth = currentReferenceMonth()
  const currentYearMonth = referenceMonthToYearMonth(currentRefMonth)
  const hasCurrentMonthPendingYield = balances.some((balance) => balance.pendingYield)
  const latestTimelinePoint = timeline.at(-1)
  const heroTimeline =
    hasCurrentMonthPendingYield && latestTimelinePoint?.month === currentYearMonth
      ? timeline.slice(0, -1)
      : timeline

  const delta =
    heroTimeline.length >= 2
      ? heroTimeline[heroTimeline.length - 1].total - heroTimeline[heroTimeline.length - 2].total
      : null
  const prevMonthTotal =
    heroTimeline.length >= 2 ? heroTimeline[heroTimeline.length - 2].total : null
  const deltaPercent =
    delta !== null && prevMonthTotal && prevMonthTotal > 0 ? (delta / prevMonthTotal) * 100 : null
  const prevMonthLabel =
    heroTimeline.length >= 2
      ? formatMonthAbbr(
          referenceMonthToYearMonth(heroTimeline[heroTimeline.length - 2].month + '-01')
        )
      : null

  const thisMonthAporte = balances.reduce((s, b) => {
    const entry = b.entries.find((e) => e.referenceMonth === currentRefMonth)
    return s + (entry?.amount ?? 0)
  }, 0)
  const thisMonthYield = balances.reduce((s, b) => {
    const entry = b.entries.find((e) => e.referenceMonth === currentRefMonth)
    return s + (entry?.yieldAmount ?? 0)
  }, 0)

  return (
    <PageLayout>
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Investimentos"
          description="Acompanhe seus aportes, rendimentos e patrimônio acumulado."
        />
        <div className="hidden items-center gap-2 lg:flex">
          <PrivacyToggle />
          <InvestmentTypeDialog mode="create" triggerSize="md" />
          <InvestmentEntryDialog investmentTypes={investmentTypeOptions} />
        </div>
      </div>

      {/* Hero — oculto na view arquivada (dados seriam apenas dos tipos arquivados) */}
      {!showArchived && balances.length > 0 && (
        <PatrimonyHero
          total={totalPatrimony}
          totalAporte={totalAporte}
          totalYield={totalYield}
          delta={delta}
          deltaPercent={deltaPercent}
          prevMonthLabel={prevMonthLabel}
          thisMonthAporte={thisMonthAporte}
          thisMonthYield={thisMonthYield}
        />
      )}

      {/* ── Patrimônio por tipo ─────────────────────────────────────────────── */}
      <Section
        title="Patrimônio por tipo"
        action={
          <div className="flex items-center gap-2">
            <ArchivedFilterChip count={archivedCount} active={showArchived} />
            <span className="whitespace-nowrap text-caption tabular-nums text-text-tertiary">
              <strong className="font-semibold text-text-primary">
                {showArchived ? archivedCount : balances.length}
              </strong>{' '}
              {showArchived
                ? archivedCount === 1
                  ? 'tipo arquivado'
                  : 'tipos arquivados'
                : balances.length === 1
                  ? 'tipo ativo'
                  : 'tipos ativos'}
              <span className="hidden md:inline"> · ordenados por valor</span>
            </span>
            {!showArchived && balances.length > 0 && (
              <div className="lg:hidden">
                <InvestmentTypeDialog mode="create" />
              </div>
            )}
          </div>
        }
      >
        {balances.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-10">
            {showArchived ? (
              <EmptyState title="Nenhum tipo arquivado." />
            ) : (
              <>
                <EmptyState
                  title="Nenhum tipo de investimento cadastrado."
                  description="Crie seu primeiro tipo para começar a registrar aportes e rendimentos."
                />
                <InvestmentTypeDialog mode="create" />
              </>
            )}
          </div>
        ) : (
          <>
            {/* Desktop — type cards with table */}
            <div className="hidden flex-col gap-4 lg:flex">
              {balances.map((balance) => (
                <InvestmentTypeCard key={balance.id} balance={balance} />
              ))}
            </div>

            {/* Mobile — accordion */}
            <div className="lg:hidden">
              <InvestmentTypeAccordion balances={balances} totalPatrimony={totalPatrimony} />
            </div>
          </>
        )}
      </Section>

      {/* ── Evolução do patrimônio ─────────────────────────────────────────── */}
      {!showArchived && timeline.length > 1 && (
        <section className="overflow-hidden rounded-lg border border-border bg-bg-surface shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:gap-0">
            <div>
              <span className="text-label uppercase text-text-tertiary">
                Evolução do patrimônio
              </span>
              <p className="mt-0.5 text-h3">Últimos {timeline.length} meses</p>
            </div>
            <div className="flex items-center gap-4 text-caption text-text-secondary">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-2.5 rounded-sm bg-accent" />
                Patrimônio total
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-2.5 rounded-sm border-t-2 border-dashed border-text-tertiary" />
                Capital alocado
              </span>
            </div>
          </div>
          <div className="px-5 py-4">
            <PatrimonyChart data={timeline} />
          </div>
        </section>
      )}

      {/* ── Resgates ───────────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-lg border border-border bg-bg-surface shadow-sm">
        <div className="flex items-center justify-between px-5 py-4">
          <span className="whitespace-nowrap text-label uppercase text-text-tertiary">
            Resgates<span className="hidden sm:inline"> · últimos 6 meses</span>
          </span>
          <WithdrawalDialog investmentTypes={investmentTypeOptions} />
        </div>

        {withdrawals.length === 0 ? (
          <EmptyState title="Sem resgates nos últimos 6 meses." className="px-5 py-8" />
        ) : (
          <WithdrawalTable
            withdrawals={withdrawals}
            investmentTypeOptions={investmentTypeOptions}
          />
        )}
      </section>
    </PageLayout>
  )
}
