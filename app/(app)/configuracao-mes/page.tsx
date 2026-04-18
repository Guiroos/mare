import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getCategoriesWithBudgets } from '@/lib/queries/categories';
import { getMonthFixedExpenses, getMonthTransactions } from '@/lib/queries/dashboard';
import {
  currentYearMonth,
  yearMonthToReferenceMonth,
  prevMonth,
  formatCurrency,
} from '@/lib/format';
import { MonthSelector } from '@/components/dashboard/MonthSelector';
import { FixedExpenseList } from '@/components/dashboard/FixedExpenseList';
import { BudgetOverrideDialog } from '@/components/configuracao-mes/BudgetOverrideDialog';
import { CopyPrevMonthButton } from '@/components/configuracao-mes/CopyPrevMonthButton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default async function ConfiguracaoMesPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const session = await auth();
  if (!session) redirect('/login');

  const userId = (session.user as any).id as string;
  const month = searchParams.month ?? currentYearMonth();
  const referenceMonth = yearMonthToReferenceMonth(month);
  const prevReferenceMonth = yearMonthToReferenceMonth(prevMonth(month));

  const [categoriesWithBudgets, fixedExpenses, allTransactions] =
    await Promise.all([
      getCategoriesWithBudgets(userId, referenceMonth),
      getMonthFixedExpenses(userId, referenceMonth),
      getMonthTransactions(userId, referenceMonth),
    ]);

  const installments = allTransactions.filter((t) => t.installmentGroupId);

  const totalFixed = fixedExpenses.reduce(
    (sum, e) => sum + Number(e.amount),
    0
  );
  const totalInstallments = installments.reduce(
    (sum, t) => sum + Number(t.amount),
    0
  );

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold">Configuração do mês</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ajuste orçamentos, marque fixos e veja compromissos.
        </p>
      </div>

      <MonthSelector currentMonth={month} />

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
          <EmptyState text="Nenhuma categoria cadastrada." />
        ) : (
          <div className="space-y-3">
            {categoriesWithBudgets.map((group) => (
              <div key={group.id} className="rounded-xl border bg-card">
                <div className="px-4 py-2.5 border-b">
                  <span className="text-sm font-semibold">{group.name}</span>
                </div>
                <div className="divide-y">
                  {group.categories.map((cat) => {
                    const hasOverride = !!cat.override;
                    const effective = hasOverride
                      ? Number(cat.override!.amount)
                      : Number(cat.defaultBudget ?? 0);

                    return (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between px-4 py-2.5"
                      >
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
                            <span className="text-xs text-muted-foreground/50">
                              sem orçamento
                            </span>
                          )}
                          {hasOverride && (
                            <Badge
                              variant="outline"
                              className="text-xs px-1.5 py-0 border-blue-300 text-blue-600 dark:text-blue-400"
                            >
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
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ─── Gastos fixos ───────────────────────────────────────────────── */}
      <Section title="Gastos fixos">
        <FixedExpenseList expenses={fixedExpenses} />
      </Section>

      {/* ─── Parcelas neste mês ─────────────────────────────────────────── */}
      <Section title="Parcelas neste mês">
        {installments.length === 0 ? (
          <EmptyState text="Nenhuma parcela neste mês." />
        ) : (
          <div className="rounded-xl border bg-card divide-y">
            {installments.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {t.category && (
                      <Badge
                        variant="secondary"
                        className="text-xs px-1.5 py-0"
                      >
                        {t.category.name}
                      </Badge>
                    )}
                    {t.account && (
                      <span className="text-xs text-muted-foreground">
                        {t.account.name}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-sm font-semibold text-red-600 shrink-0">
                  {formatCurrency(Number(t.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ─── Resumo comprometido ────────────────────────────────────────── */}
      <Section title="Comprometido neste mês">
        <div className="rounded-xl border bg-card divide-y">
          <SummaryRow label="Gastos fixos" value={totalFixed} />
          <SummaryRow label="Parcelas" value={totalInstallments} />
          <SummaryRow
            label="Total comprometido"
            value={totalFixed + totalInstallments}
            bold
          />
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className={cn('text-sm', bold && 'font-semibold')}>{label}</span>
      <span className={cn('text-sm', bold ? 'font-bold text-red-600' : 'text-muted-foreground')}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}
