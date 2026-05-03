import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getActiveInstallmentGroups, getInstallmentTimeline } from '@/lib/queries/parcelas'
import { InstallmentTimelineChart } from '@/components/charts/InstallmentTimelineChart'
import { InstallmentCategoryChart } from '@/components/charts/InstallmentCategoryChart'
import { InstallmentGroupCard } from '@/components/parcelas/InstallmentGroupCard'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { PageLayout } from '@/components/ui/page-layout'
import { Section } from '@/components/ui/section'
import { formatCurrency } from '@/lib/utils/currency'
import { currentYearMonth, formatMonthShort } from '@/lib/utils/date'

function calcEndLabel(currentYM: string, remainingInstallments: number): string {
  const [year, month] = currentYM.split('-').map(Number)
  const totalMonths = year * 12 + (month - 1) + (remainingInstallments - 1)
  const endYear = Math.floor(totalMonths / 12)
  const endMonth = String((totalMonths % 12) + 1).padStart(2, '0')
  return formatMonthShort(`${endYear}-${endMonth}`)
}

export default async function ParcelasPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const userId = (session.user as { id: string }).id

  const [groups, timeline] = await Promise.all([
    getActiveInstallmentGroups(userId),
    getInstallmentTimeline(userId),
  ])

  const totalRestante = groups.reduce((sum, g) => sum + g.remainingAmount, 0)
  const totalMensal = groups.reduce((sum, g) => sum + g.installmentAmount, 0)
  const totalPago = groups.reduce((sum, g) => sum + g.paidInstallments * g.installmentAmount, 0)

  const currentYM = currentYearMonth()

  const groupsWithEnd = groups.map((g) => ({
    ...g,
    endLabel: calcEndLabel(currentYM, g.remainingInstallments),
  }))

  const categoryData = Object.values(
    groups.reduce<Record<string, { name: string; value: number; color?: string }>>((acc, g) => {
      if (acc[g.categoryId]) {
        acc[g.categoryId].value += g.installmentAmount
      } else {
        acc[g.categoryId] = {
          name: g.categoryName,
          value: g.installmentAmount,
          color: g.categoryColor,
        }
      }
      return acc
    }, {})
  )

  return (
    <PageLayout>
      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <PageHeader
        title="Parcelas Futuras"
        description="Acompanhe suas compras parceladas e os compromissos por mês."
      />

      {/* ─── Resumo ──────────────────────────────────────────────────────────── */}
      {groupsWithEnd.length > 0 && (
        <div className="rounded-xl border bg-bg-surface px-5 py-4">
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <p className="text-xs text-text-secondary">Total restante</p>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalRestante)}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Por mês</p>
              <p className="text-lg font-semibold tabular-nums">{formatCurrency(totalMensal)}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Total já pago</p>
              <p className="text-lg font-semibold tabular-nums">{formatCurrency(totalPago)}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Parcelas ativas</p>
              <p className="text-lg font-semibold">{groupsWithEnd.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Parcelas ativas ─────────────────────────────────────────────────── */}
      <Section title="Parcelas ativas">
        {groupsWithEnd.length === 0 ? (
          <EmptyState title="Nenhuma parcela ativa." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {groupsWithEnd.map((group) => (
              <InstallmentGroupCard key={group.id} group={group} />
            ))}
          </div>
        )}
      </Section>

      {/* ─── Gráficos ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Distribuição por categoria">
          <div className="rounded-xl border bg-bg-surface px-4 py-4">
            <InstallmentCategoryChart data={categoryData} />
          </div>
        </Section>

        <Section title="Compromissos por mês">
          <div className="flex flex-col rounded-xl border bg-bg-surface px-4 py-4">
            <div className="min-h-0 flex-1">
              <InstallmentTimelineChart data={timeline} />
            </div>
          </div>
        </Section>
      </div>
    </PageLayout>
  )
}
