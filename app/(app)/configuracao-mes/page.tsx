import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getCategoriesWithBudgets } from '@/lib/queries/categories'
import { getMonthFixedExpenses, getMonthTransactions } from '@/lib/queries/dashboard'
import { getUserAutoRollover } from '@/lib/queries/settings'
import { formatCurrency } from '@/lib/utils/currency'
import {
  currentYearMonth,
  yearMonthToReferenceMonth,
  prevMonth,
  todayParts,
} from '@/lib/utils/date'
import { MonthSelector } from '@/components/dashboard/MonthSelector'
import { FixedExpenseList } from '@/components/dashboard/FixedExpenseList'
import { BudgetOverrideDialog } from '@/components/configuracao-mes/BudgetOverrideDialog'
import { CopyPrevMonthButton } from '@/components/configuracao-mes/CopyPrevMonthButton'
import { CopyFixedExpensesButton } from '@/components/configuracao-mes/CopyFixedExpensesButton'
import { AutoRolloverSwitch } from '@/components/configuracao-mes/AutoRolloverSwitch'
import { PageHeader } from '@/components/ui/page-header'
import { PageLayout } from '@/components/ui/page-layout'
import { Section } from '@/components/ui/section'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils/cn'

export default async function ConfiguracaoMesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const userId = session.user.id
  const { month: rawMonth } = await searchParams
  const month = rawMonth ?? currentYearMonth()
  const { day: todayDay, year: currentYear, month: currentMonth } = todayParts()
  const [displayYear, displayMonth] = month.split('-').map(Number)
  const isCurrentMonth = month === currentYearMonth()
  const isPastMonth =
    displayYear < currentYear || (displayYear === currentYear && displayMonth < currentMonth)
  const referenceMonth = yearMonthToReferenceMonth(month)
  const prevReferenceMonth = yearMonthToReferenceMonth(prevMonth(month))

  const [categoriesWithBudgets, fixedExpenses, allTransactions, autoRollover] = await Promise.all([
    getCategoriesWithBudgets(userId, referenceMonth),
    getMonthFixedExpenses(userId, referenceMonth),
    getMonthTransactions(userId, referenceMonth),
    getUserAutoRollover(userId),
  ])

  const installments = allTransactions.filter((t) => t.installmentGroupId)

  const totalFixed = fixedExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const totalInstallments = installments.reduce((sum, t) => sum + Number(t.amount), 0)

  return (
    <PageLayout>
      <PageHeader
        title="Configuração do mês"
        description="Ajuste orçamentos, marque fixos e veja compromissos."
      />

      <MonthSelector currentMonth={month} isCurrentMonth={isCurrentMonth} />

      {/* ─── Resumo comprometido ─────────────────────────────────────────── */}
      <CommittedSummary totalFixed={totalFixed} totalInstallments={totalInstallments} />

      {/* ─── Orçamentos do mês ──────────────────────────────────────────── */}
      <Section
        title="Orçamentos do mês"
        action={
          <CopyPrevMonthButton
            referenceMonth={referenceMonth}
            prevReferenceMonth={prevReferenceMonth}
          />
        }
      >
        {categoriesWithBudgets.length === 0 ? (
          <EmptyState title="Nenhuma categoria cadastrada." />
        ) : (
          <div className="space-y-3">
            {categoriesWithBudgets.map((group) => (
              <div key={group.id} className="rounded-xl border bg-bg-surface">
                <div className="border-b px-4 py-2.5">
                  <span className="text-body font-semibold">{group.name}</span>
                </div>
                <div className="divide-y">
                  {group.categories.map((cat) => {
                    const hasOverride = !!cat.override
                    const effective = hasOverride
                      ? Number(cat.override!.amount)
                      : Number(cat.defaultBudget ?? 0)

                    return (
                      <div key={cat.id} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-body">{cat.name}</span>
                        <div className="flex items-center gap-2">
                          {effective > 0 ? (
                            <span
                              className={cn(
                                'text-body font-medium',
                                hasOverride ? 'text-accent' : 'text-text-secondary'
                              )}
                            >
                              {formatCurrency(effective)}
                            </span>
                          ) : (
                            <span className="text-caption text-text-secondary opacity-50">
                              sem orçamento
                            </span>
                          )}
                          {hasOverride && (
                            <Badge variant="accent" size="sm">
                              override
                            </Badge>
                          )}
                          <BudgetOverrideDialog
                            categoryId={cat.id}
                            categoryName={cat.name}
                            referenceMonth={referenceMonth}
                            defaultBudget={cat.defaultBudget}
                            override={cat.override}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ─── Gastos fixos ───────────────────────────────────────────────── */}
      <Section
        title="Gastos fixos"
        action={
          <CopyFixedExpensesButton
            referenceMonth={referenceMonth}
            prevReferenceMonth={prevReferenceMonth}
          />
        }
      >
        <FixedExpenseList
          expenses={fixedExpenses}
          yearMonth={month}
          isCurrentMonth={isCurrentMonth}
          isPastMonth={isPastMonth}
          todayDay={todayDay}
        />
      </Section>

      {/* ─── Automação ──────────────────────────────────────────────────── */}
      <Section title="Automação">
        <div className="rounded-xl border bg-bg-surface px-4 py-4">
          <AutoRolloverSwitch initialEnabled={autoRollover} />
        </div>
      </Section>

      {/* ─── Parcelas neste mês ─────────────────────────────────────────── */}
      <Section title="Parcelas neste mês">
        {installments.length === 0 ? (
          <EmptyState title="Nenhuma parcela neste mês." />
        ) : (
          <div className="divide-y rounded-xl border bg-bg-surface">
            {installments.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-medium">{t.name}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {t.category && (
                      <Badge variant="muted" size="sm">
                        {t.category.name}
                      </Badge>
                    )}
                    {t.account && (
                      <span className="text-caption text-text-secondary">{t.account.name}</span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-body font-semibold text-negative">
                  {formatCurrency(Number(t.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </PageLayout>
  )
}

function CommittedSummary({
  totalFixed,
  totalInstallments,
}: {
  totalFixed: number
  totalInstallments: number
}) {
  return (
    <div className="rounded-xl border bg-bg-surface px-5 py-4">
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <p className="text-caption text-text-secondary">Gastos fixos</p>
          <p className="text-h3 font-semibold tabular-nums">{formatCurrency(totalFixed)}</p>
        </div>
        <div>
          <p className="text-caption text-text-secondary">Parcelas</p>
          <p className="text-h3 font-semibold tabular-nums">{formatCurrency(totalInstallments)}</p>
        </div>
        <div>
          <p className="text-caption text-text-secondary">Total comprometido</p>
          <p className="text-h2 font-bold tabular-nums text-negative">
            {formatCurrency(totalFixed + totalInstallments)}
          </p>
        </div>
      </div>
    </div>
  )
}
