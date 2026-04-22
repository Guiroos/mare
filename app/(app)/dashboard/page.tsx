import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getDashboardData } from '@/lib/queries/dashboard';
import { currentYearMonth, yearMonthToReferenceMonth, formatCurrency } from '@/lib/format';
import { MonthSelector } from '@/components/dashboard/MonthSelector';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { CategoryGroupProgress } from '@/components/dashboard/CategoryGroupProgress';
import { TransactionList } from '@/components/dashboard/TransactionList';
import { FixedExpenseList } from '@/components/dashboard/FixedExpenseList';
import { IncomeList } from '@/components/dashboard/IncomeList';
import { DashboardFAB } from '@/components/dashboard/DashboardFAB';
import { InvestmentList } from '@/components/dashboard/InvestmentList';
import { PendencyBanner } from '@/components/dashboard/PendencyBanner';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const session = await auth();
  if (!session) redirect('/login');

  const userId = (session.user as any).id as string;
  const month = searchParams.month ?? currentYearMonth();
  const referenceMonth = yearMonthToReferenceMonth(month);

  const data = await getDashboardData(userId, referenceMonth);

  const isCurrentMonth = month === currentYearMonth();
  const unpaidFixedCount = isCurrentMonth
    ? data.fixedExpenses.filter((e) => !e.paid).length
    : 0;
  const pendingYieldCount = isCurrentMonth
    ? data.investments.filter((i) => i.amount !== null && i.yieldAmount === null).length
    : 0;

  const pendingFixed = data.fixedExpenses.filter((e) => !e.paid).length;
  const totalTransactions = data.transactions.length;
  const totalIncomes = data.summary.totalIncomes;
  const totalInvested = data.summary.totalInvested;

  return (
    <div className="flex flex-col gap-7">
      <MonthSelector currentMonth={month} />

      <PendencyBanner
        unpaidFixedCount={unpaidFixedCount}
        pendingYieldCount={pendingYieldCount}
      />

      <SummaryCards summary={data.summary} />

      {/* Row 1: Orçamento + Gastos Fixos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section title="Orçamento por categoria">
          <CategoryGroupProgress groups={data.groupProgress} />
        </Section>

        <Section
          title="Gastos fixos"
          count={pendingFixed > 0 ? `${pendingFixed} pendente${pendingFixed > 1 ? 's' : ''}` : undefined}
        >
          <FixedExpenseList expenses={data.fixedExpenses} yearMonth={month} />
        </Section>
      </div>

      {/* Transações — full width */}
      <Section
        title="Transações"
        count={totalTransactions > 0 ? `${totalTransactions} este mês` : undefined}
      >
        <TransactionList transactions={data.transactions} />
      </Section>

      {/* Row 2: Entradas + Investimentos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section
          title="Entradas"
          count={totalIncomes > 0 ? formatCurrency(totalIncomes) : undefined}
          countVariant="positive"
        >
          <IncomeList incomes={data.incomes} />
        </Section>

        <Section
          title="Investimentos"
          count={totalInvested > 0 ? formatCurrency(totalInvested) : undefined}
        >
          <InvestmentList investments={data.investments} />
        </Section>
      </div>

      <DashboardFAB month={month} />
    </div>
  );
}

function Section({
  title,
  children,
  count,
  countVariant = 'default',
}: {
  title: string;
  children: React.ReactNode;
  count?: string;
  countVariant?: 'default' | 'positive';
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h2
          className="text-[11px] font-semibold uppercase text-text-tertiary"
          style={{ letterSpacing: '0.08em' }}
        >
          {title}
        </h2>
        {count && (
          <span
            className={
              countVariant === 'positive'
                ? 'text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-positive-subtle text-positive-text border-positive'
                : 'text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-bg-subtle text-text-tertiary border-border'
            }
          >
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
