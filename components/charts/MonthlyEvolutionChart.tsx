'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type Props = {
  data: { month: string; totalIncomes: number; totalExpenses: number; totalInvested: number }[];
};

function formatMonthLabel(yyyyMM: string) {
  const [year, month] = yyyyMM.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('pt-BR', {
    month: 'short',
    year: '2-digit',
  });
}

function formatCurrencyShort(value: number) {
  if (value >= 1000) return `R$${(value / 1000).toFixed(1)}k`;
  return `R$${value.toFixed(0)}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function MonthlyEvolutionChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
        Nenhum dado ainda.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    month: formatMonthLabel(d.month),
    Entradas: d.totalIncomes,
    Gastos: d.totalExpenses,
    Investimentos: d.totalInvested,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          tickFormatter={formatCurrencyShort}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          labelFormatter={(label) => `Mês: ${label}`}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="Entradas" fill="#10b981" radius={[2, 2, 0, 0]} />
        <Bar dataKey="Gastos" fill="#ef4444" radius={[2, 2, 0, 0]} />
        <Bar dataKey="Investimentos" fill="#3b82f6" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
