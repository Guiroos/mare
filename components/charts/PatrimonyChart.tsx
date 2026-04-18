'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

type DataPoint = { month: string; total: number };

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

export function PatrimonyChart({ data }: { data: DataPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Nenhum dado ainda.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    month: formatMonthLabel(d.month),
    total: d.total,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={formatCurrencyShort}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip
          formatter={(value: number) =>
            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
          }
          labelFormatter={(label) => `Mês: ${label}`}
        />
        <Line
          type="monotone"
          dataKey="total"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          className="stroke-primary"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
