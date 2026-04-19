import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getDashboardData } from '@/lib/queries/dashboard';
import { currentYearMonth, yearMonthToReferenceMonth } from '@/lib/format';
import { MonthSelector } from '@/components/dashboard/MonthSelector';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { CategoryGroupProgress } from '@/components/dashboard/CategoryGroupProgress';
import { TransactionList } from '@/components/dashboard/TransactionList';
import { FixedExpenseList } from '@/components/dashboard/FixedExpenseList';
import { IncomeList } from '@/components/dashboard/IncomeList';
import { DashboardFAB } from '@/components/dashboard/DashboardFAB';
import { InvestmentList } from '@/components/dashboard/InvestmentList';
import { PendencyBanner } from '@/components/dashboard/PendencyBanner';
import { ExpensePieChart } from '@/components/charts/ExpensePieChart';
import { MonthlyEvolutionChart } from '@/components/charts/MonthlyEvolutionChart';

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

  const pieData = data.groupProgress
    .flatMap((g) =>
      g.categories.map((c) => ({ id: c.id, name: c.name, totalSpent: c.spent, totalBudget: c.budget }))
    )
    .filter((c) => c.totalSpent > 0);

  return (
    <div className="space-y-6">
      <MonthSelector currentMonth={month} />

      <PendencyBanner
        unpaidFixedCount={unpaidFixedCount}
        pendingYieldCount={pendingYieldCount}
      />

      <SummaryCards summary={data.summary} />

      <Section title="Orçamento por categoria">
        <CategoryGroupProgress groups={data.groupProgress} />
      </Section>

      <Section title="Gastos por categoria">
        <ExpensePieChart data={pieData} />
      </Section>

      <Section title="Evolução mensal">
        <MonthlyEvolutionChart data={data.monthlyEvolution} />
      </Section>

      <Section title="Gastos fixos">
        <FixedExpenseList expenses={data.fixedExpenses} />
      </Section>

      <Section title="Transações">
        <TransactionList transactions={data.transactions} />
      </Section>

      <Section title="Entradas">
        <IncomeList incomes={data.incomes} />
      </Section>

      <Section title="Investimentos">
        <InvestmentList investments={data.investments} />
      </Section>

      <DashboardFAB month={month} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </div>
  );
}
