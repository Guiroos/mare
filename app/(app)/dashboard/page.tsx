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

  return (
    <div className="space-y-6">
      <MonthSelector currentMonth={month} />

      <SummaryCards summary={data.summary} />

      <Section title="Orçamento por categoria">
        <CategoryGroupProgress groups={data.groupProgress} />
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
