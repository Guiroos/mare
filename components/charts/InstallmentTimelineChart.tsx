'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

type Props = {
  data: { month: string; total: number; groups: { name: string; amount: number }[] }[];
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

export function InstallmentTimelineChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
        Nenhum compromisso futuro.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    month: formatMonthLabel(d.month),
    total: d.total,
    _groups: d.groups,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
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
          formatter={(value: number) => [formatCurrency(value), 'Total']}
          labelFormatter={(label) => `Mês: ${label}`}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const entry = payload[0]?.payload as (typeof chartData)[0];
            return (
              <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
                <p className="font-medium mb-1">Mês: {label}</p>
                {entry._groups.map((g) => (
                  <p key={g.name} className="text-muted-foreground">
                    {g.name}: {formatCurrency(g.amount)}
                  </p>
                ))}
                <p className="font-semibold mt-1 pt-1 border-t">
                  Total: {formatCurrency(entry.total)}
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="total" fill="#3b82f6" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
