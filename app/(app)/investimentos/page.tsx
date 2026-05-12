import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import {
  getInvestmentBalances,
  getInvestmentWithdrawals,
  getPatrimonyTimeline,
} from '@/lib/queries/investments'
import { deleteWithdrawal } from '@/lib/actions/investments'
import { formatCurrency } from '@/lib/utils/currency'
import {
  formatMonthAbbr,
  currentReferenceMonth,
  referenceMonthToYearMonth,
  formatDate,
} from '@/lib/utils/date'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Section } from '@/components/ui/section'
import { InvestmentTypeDialog } from '@/components/investimentos/InvestmentTypeDialog'
import { InvestmentEntryDialog } from '@/components/investimentos/InvestmentEntryDialog'
import { WithdrawalDialog } from '@/components/investimentos/WithdrawalDialog'
import { WithdrawalEditButton } from '@/components/investimentos/WithdrawalEditButton'
import { DeleteButton } from '@/components/ui/delete-button'
import { PatrimonyChart } from '@/components/charts/PatrimonyChart'
import { PatrimonyHero } from '@/components/investimentos/PatrimonyHero'
import { InvestmentTypeCard } from '@/components/investimentos/InvestmentTypeCard'
import { InvestmentTypeAccordion } from '@/components/investimentos/InvestmentTypeAccordion'
import { PageHeader } from '@/components/ui/page-header'
import { PageLayout } from '@/components/ui/page-layout'

export default async function InvestimentosPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const userId = session.user.id

  const [balances, withdrawals, timeline] = await Promise.all([
    getInvestmentBalances(userId),
    getInvestmentWithdrawals(userId),
    getPatrimonyTimeline(userId),
  ])

  const investmentTypeOptions = balances.map((b) => ({ id: b.id, name: b.name }))

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
          <InvestmentTypeDialog mode="create" triggerSize="md" />
          <InvestmentEntryDialog investmentTypes={investmentTypeOptions} />
        </div>
      </div>

      {/* Hero */}
      {balances.length > 0 && (
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
            <span className="whitespace-nowrap text-caption tabular-nums text-text-tertiary">
              <strong className="font-semibold text-text-primary">{balances.length}</strong>{' '}
              {balances.length === 1 ? 'tipo ativo' : 'tipos ativos'}
              <span className="hidden md:inline"> · ordenados por valor</span>
            </span>
            {balances.length > 0 && (
              <div className="lg:hidden">
                <InvestmentTypeDialog mode="create" />
              </div>
            )}
          </div>
        }
      >
        {balances.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-10">
            <EmptyState
              title="Nenhum tipo de investimento cadastrado."
              description="Crie seu primeiro tipo para começar a registrar aportes e rendimentos."
            />
            <InvestmentTypeDialog mode="create" />
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
      {timeline.length > 1 && (
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
                Aporte acumulado
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse">
              <thead>
                <tr className="border-b border-border bg-bg-subtle">
                  <th className="px-5 py-2 text-left text-label uppercase text-text-tertiary">
                    Tipo
                  </th>
                  <th className="px-5 py-2 text-left text-label uppercase text-text-tertiary">
                    Data
                  </th>
                  <th className="px-5 py-2 text-right text-label uppercase text-text-tertiary">
                    Valor
                  </th>
                  <th className="px-5 py-2 text-left text-label uppercase text-text-tertiary">
                    Destino
                  </th>
                  <th className="px-5 py-2 text-left text-label uppercase text-text-tertiary">
                    Notas
                  </th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id} className="border-t border-border hover:bg-bg-subtle">
                    <td className="px-5 py-2.5 text-small">{w.typeName}</td>
                    <td className="px-5 py-2.5 text-small text-text-secondary">
                      {formatDate(w.date)}
                    </td>
                    <td className="px-5 py-2.5 text-right text-small font-semibold tabular-nums text-negative-text">
                      − {formatCurrency(w.amount)}
                    </td>
                    <td className="px-5 py-2.5">
                      {w.destination === 'income' ? (
                        <Badge variant="muted">Caixa</Badge>
                      ) : (
                        <Badge variant="muted">Transferência</Badge>
                      )}
                    </td>
                    <td className="max-w-32 truncate px-5 py-2.5 text-caption text-text-secondary">
                      {w.notes ?? ''}
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-1">
                        <WithdrawalEditButton
                          withdrawal={w}
                          investmentTypes={investmentTypeOptions}
                        />
                        <DeleteButton
                          onDelete={async () => {
                            'use server'
                            await deleteWithdrawal(w.id)
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageLayout>
  )
}
