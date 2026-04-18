'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatMonth, prevMonth, nextMonth, currentYearMonth } from '@/lib/format';

export function MonthSelector({ currentMonth }: { currentMonth: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const isCurrentMonth = currentMonth === currentYearMonth();

  const navigate = (month: string) => {
    router.push(`${pathname}?month=${month}`);
  };

  return (
    <div className="flex items-center justify-between">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate(prevMonth(currentMonth))}
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <button
        onClick={() => navigate(currentYearMonth())}
        className="text-base font-semibold capitalize hover:text-primary transition-colors"
      >
        {formatMonth(currentMonth)}
      </button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate(nextMonth(currentMonth))}
        disabled={isCurrentMonth}
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
