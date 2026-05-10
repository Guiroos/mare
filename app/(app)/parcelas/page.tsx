import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getActiveInstallmentGroups, getInstallmentTimeline } from '@/lib/queries/parcelas'
import { InstallmentTimelineChart } from '@/components/charts/InstallmentTimelineChart'
import { InstallmentCategoryChart } from '@/components/charts/InstallmentCategoryChart'
import { ParcelasToolbar } from '@/components/parcelas/ParcelasToolbar'
import { EmptyState } from '@/components/ui/empty-state'
import { Card } from '@/components/ui/card'
import { Section } from '@/components/ui/section'
import { PageHeader } from '@/components/ui/page-header'
import { PageLayout } from '@/components/ui/page-layout'
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

  const userId = session.user.id
  const currentYM = currentYearMonth()

  const [groups, timeline] = await Promise.all([
    getActiveInstallmentGroups(userId),
    getInstallmentTimeline(userId),
  ])

  const totalRestante = groups.reduce((sum, g) => sum + g.remainingAmount, 0)
  const totalMensal = groups.reduce((sum, g) => sum + g.installmentAmount, 0)
  const totalPago = groups.reduce((sum, g) => sum + g.paidInstallments * g.installmentAmount, 0)
  const totalAll = groups.reduce((sum, g) => sum + g.totalAmount, 0)
  const paidPct = totalAll > 0 ? Math.round((totalPago / totalAll) * 100) : 0

  const groupsWithEnd = groups.map((g) => ({
    ...g,
    endLabel: calcEndLabel(currentYM, g.remainingInstallments),
  }))

  const endLabels = groupsWithEnd.map((g) => g.endLabel).sort()
  const lastEnd = endLabels[endLabels.length - 1] ?? null

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
      <PageHeader
        title="Parcelas Futuras"
        description="Acompanhe suas compras parceladas e os compromissos por mês."
      />

      {groupsWithEnd.length > 0 && (
        <>
          {/* ─── Desktop KPIs (4 cards) ───────────────────────── */}
          <div className="hidden gap-3 lg:grid lg:grid-cols-4">
            <Card padding="md" className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-label uppercase text-text-tertiary">Total restante</p>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-subtle">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                </div>
              </div>
              <p className="text-h2 tabular-nums">{formatCurrency(totalRestante)}</p>
              {lastEnd && <p className="text-caption text-text-tertiary">termina em {lastEnd}</p>}
            </Card>

            <Card padding="md" className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-label uppercase text-text-tertiary">Por mês</p>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-negative-subtle">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--negative)"
                    strokeWidth="2"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
              </div>
              <p className="text-h2 tabular-nums">{formatCurrency(totalMensal)}</p>
              <p className="text-caption text-text-tertiary">comprometido este mês</p>
            </Card>

            <Card padding="md" className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-label uppercase text-text-tertiary">Total já pago</p>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-positive-subtle">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--positive)"
                    strokeWidth="2.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>
              <p className="text-h2 tabular-nums">{formatCurrency(totalPago)}</p>
              <p className="text-caption tabular-nums text-text-tertiary">
                {paidPct}% das parcelas quitadas
              </p>
            </Card>

            <Card padding="md" className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-label uppercase text-text-tertiary">Parcelas ativas</p>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-bg-subtle">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-secondary)"
                    strokeWidth="2"
                  >
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                </div>
              </div>
              <p className="text-h2">
                {groupsWithEnd.length}{' '}
                <span className="text-body font-normal text-text-tertiary">compras</span>
              </p>
              {lastEnd && <p className="text-caption text-text-tertiary">termina em {lastEnd}</p>}
            </Card>
          </div>

          {/* ─── Mobile hero card ─────────────────────────────── */}
          {/* style gradient is decorative/brand — oklch() in style={{}} is allowed per DS rules */}
          <div
            className="relative overflow-hidden rounded-xl p-5 text-white lg:hidden"
            style={{
              background: 'linear-gradient(140deg, var(--accent) 0%, oklch(38% 0.14 235) 100%)',
            }}
          >
            <svg
              className="pointer-events-none absolute right-0 top-0 opacity-20"
              width="160"
              height="160"
              viewBox="0 0 100 100"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 60 C25 35, 45 25, 65 50 C85 75, 95 60, 115 40"
                stroke="white"
                strokeWidth="9"
                strokeLinecap="round"
              />
              <path
                d="M5 80 C25 55, 50 45, 70 65 C90 85, 100 75, 120 60"
                stroke="white"
                strokeWidth="6"
                strokeLinecap="round"
                opacity="0.7"
              />
            </svg>
            <p className="text-caption font-semibold uppercase opacity-80">Total restante</p>
            <p className="mt-1 text-h1 tabular-nums">{formatCurrency(totalRestante)}</p>
            <div
              className="mt-4 grid grid-cols-3 gap-2 border-t pt-3"
              style={{ borderColor: 'oklch(100% 0 0 / 0.18)' }}
            >
              <div>
                <p className="text-caption font-medium uppercase opacity-75">Por mês</p>
                <p className="text-small font-semibold tabular-nums">
                  {formatCurrency(totalMensal)}
                </p>
              </div>
              <div>
                <p className="text-caption font-medium uppercase opacity-75">Já pago</p>
                <p className="text-small font-semibold tabular-nums">{formatCurrency(totalPago)}</p>
              </div>
              <div>
                <p className="text-caption font-medium uppercase opacity-75">Ativas</p>
                <p className="text-small font-semibold">{groupsWithEnd.length}</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ─── Toolbar + cards ──────────────────────────────────── */}
      {groupsWithEnd.length === 0 ? (
        <EmptyState title="Nenhuma parcela ativa." />
      ) : (
        <ParcelasToolbar groups={groupsWithEnd} />
      )}

      {/* ─── Gráficos ─────────────────────────────────────────── */}
      {groupsWithEnd.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Section title="Distribuição por categoria">
            <Card padding="sm">
              <InstallmentCategoryChart data={categoryData} />
            </Card>
          </Section>

          <Section title="Compromissos por mês">
            <Card padding="sm">
              <div className="h-72">
                <InstallmentTimelineChart data={timeline} currentYM={currentYM} />
              </div>
            </Card>
          </Section>
        </div>
      )}
    </PageLayout>
  )
}
