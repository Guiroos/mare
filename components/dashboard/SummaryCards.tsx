import { ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';

type Summary = {
  totalIncomes: number;
  totalExpenses: number;
  totalInvested: number;
  balance: number;
};

export function SummaryCards({ summary }: { summary: Summary }) {
  const { totalIncomes, totalExpenses, totalInvested, balance } = summary;
  const balancePositive = balance >= 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <ArrowDownCircle className="h-4 w-4 text-green-500" />
            <span className="text-xs font-medium">Entradas</span>
          </div>
          <p className="text-lg font-bold text-green-600">
            {formatCurrency(totalIncomes)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <ArrowUpCircle className="h-4 w-4 text-red-500" />
            <span className="text-xs font-medium">Gastos</span>
          </div>
          <p className="text-lg font-bold text-red-600">
            {formatCurrency(totalExpenses)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <ArrowUpCircle className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-medium">Investido</span>
          </div>
          <p className="text-lg font-bold text-blue-600">
            {formatCurrency(totalInvested)}
          </p>
        </CardContent>
      </Card>

      <Card className="col-span-2 lg:col-span-1">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Wallet className="h-4 w-4" />
            <span className="text-xs font-medium">Saldo</span>
          </div>
          <p className={`text-lg font-bold ${balancePositive ? 'text-foreground' : 'text-red-600'}`}>
            {formatCurrency(balance)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
