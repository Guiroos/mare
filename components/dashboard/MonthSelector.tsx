'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { prevMonth, nextMonth, currentYearMonth } from '@/lib/format';

export function MonthSelector({ currentMonth }: { currentMonth: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const isCurrentMonth = currentMonth === currentYearMonth();

  const formatMonthYear = (yearMonth: string) => {
    const [year, month] = yearMonth.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    const monthName = date.toLocaleDateString('pt-BR', { month: 'long' });
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
  };

  const navigate = (month: string) => router.push(`${pathname}?month=${month}`);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        {/* Prev */}
        <button
          onClick={() => navigate(prevMonth(currentMonth))}
          aria-label="Mês anterior"
          className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-bg-subtle text-text-tertiary hover:text-text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Pill */}
        <div className="flex items-center px-3.5 py-1.5 rounded-full cursor-default bg-bg-surface border-2 border-border shadow-sm">
          <span className="text-body font-semibold text-text-primary">
            {formatMonthYear(currentMonth)}
          </span>
        </div>

        {/* Next */}
        <button
          onClick={() => navigate(nextMonth(currentMonth))}
          disabled={isCurrentMonth}
          aria-label="Próximo mês"
          className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-bg-subtle text-text-tertiary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Jump to current month */}
      {!isCurrentMonth && (
        <button
          onClick={() => navigate(currentYearMonth())}
          className="flex items-center gap-1 text-caption font-semibold px-3 py-1.5 rounded-full bg-accent text-text-inverse shadow-sm transition-all hover:shadow-md active:scale-95"
        >
          Mês atual
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
