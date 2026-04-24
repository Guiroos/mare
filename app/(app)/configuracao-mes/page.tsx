import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getCategoriesWithBudgets } from '@/lib/queries/categories'
import { getMonthFixedExpenses, getMonthTransactions } from '@/lib/queries/dashboard'
import {
  currentYearMonth,
  yearMonthToReferenceMonth,
  prevMonth,
  formatCurrency,
} from '@/lib/format'
import { MonthSelector } from '@/components/dashboard/MonthSelector'
import { FixedExpenseList } from '@/components/dashboard/FixedExpenseList'
import { BudgetOverrideDialog } from '@/components/configuracao-mes/BudgetOverrideDialog'
import { CopyPrevMonthButton } from '@/components/configuracao-mes/CopyPrevMonthButton'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

export default async function ConfiguracaoMesPage({
  searchParams,
}: {
  searchParams: { month?: string }
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const userId = (session.user as { id: string }).id
  const month = searchParams.month ?? currentYearMonth()
  const today = new Date()
  const todayDay = today.getDate()
  const [currentYear, currentMonth] = [today.getFullYear(), today.getMonth() + 1]
  const [displayYear, displayMonth] = month.split('-').map(Number)
  const isCurrentMonth = month === currentYearMonth()
  const isPastMonth =
    displayYear < currentYear || (displayYear === currentYear && displayMonth < currentMonth)
  const referenceMonth = yearMonthToReferenceMonth(month)
  const prevReferenceMonth = yearMonthToReferenceMonth(prevMonth(month))

  const [categoriesWithBudgets, fixedExpenses, allTransactions] = await Promise.all([
    getCategoriesWithBudgets(userId, referenceMonth),
    getMonthFixedExpenses(userId, referenceMonth),
    getMonthTransactions(userId, referenceMonth),
  ])

  const installments = allTransactions.filter((t) => t.installmentGroupId)

  const totalFixed = fixedExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const totalInstallments = installments.reduce((sum, t) => sum + Number(t.amount), 0)

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-bold">Configuração do mês</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajuste orçamentos, marque fixos e veja compromissos.
        </p>
      </div>

      <MonthSelector currentMonth={month} isCurrentMonth={isCurrentMonth} />

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
              <div key={group.id} className="rounded-xl border bg-card">
                <div className="border-b px-4 py-2.5">
                  <span className="text-sm font-semibold">{group.name}</span>
                </div>
                <div className="divide-y">
                  {group.categories.map((cat) => {
                    const hasOverride = !!cat.override
                    const effective = hasOverride
                      ? Number(cat.override!.amount)
                      : Number(cat.defaultBudget ?? 0)

                    return (
                      <div key={cat.id} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm">{cat.name}</span>
                        <div className="flex items-center gap-2">
                          {effective > 0 ? (
                            <span
                              className={cn(
                                'text-sm font-medium',
                                hasOverride
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {formatCurrency(effective)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50 text-xs">sem orçamento</span>
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
      <Section title="Gastos fixos">
        <FixedExpenseList
          expenses={fixedExpenses}
          yearMonth={month}
          isCurrentMonth={isCurrentMonth}
          isPastMonth={isPastMonth}
          todayDay={todayDay}
        />
      </Section>

      {/* ─── Parcelas neste mês ─────────────────────────────────────────── */}
      <Section title="Parcelas neste mês">
        {installments.length === 0 ? (
          <EmptyState title="Nenhuma parcela neste mês." />
        ) : (
          <div className="divide-y rounded-xl border bg-card">
            {installments.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {t.category && (
                      <Badge variant="muted" size="sm">
                        {t.category.name}
                      </Badge>
                    )}
                    {t.account && (
                      <span className="text-xs text-muted-foreground">{t.account.name}</span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold text-red-600">
                  {formatCurrency(Number(t.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ─── Resumo comprometido ────────────────────────────────────────── */}
      <Section title="Comprometido neste mês">
        <div className="divide-y rounded-xl border bg-card">
          <SummaryRow label="Gastos fixos" value={totalFixed} />
          <SummaryRow label="Parcelas" value={totalInstallments} />
          <SummaryRow label="Total comprometido" value={totalFixed + totalInstallments} bold />
        </div>
      </Section>
    </div>
  )
}

function Section({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function SummaryRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className={cn('text-sm', bold && 'font-semibold')}>{label}</span>
      <span className={cn('text-sm', bold ? 'font-bold text-red-600' : 'text-muted-foreground')}>
        {formatCurrency(value)}
      </span>
    </div>
  )
}
