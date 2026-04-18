'use client';

import { useState, useTransition } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { copyBudgetOverridesFromPrevMonth } from '@/lib/actions/categories';

type Props = {
  referenceMonth: string;
  prevReferenceMonth: string;
};

export function CopyPrevMonthButton({
  referenceMonth,
  prevReferenceMonth,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState('');

  const handleCopy = () => {
    setMessage('');
    startTransition(async () => {
      const result = await copyBudgetOverridesFromPrevMonth(
        referenceMonth,
        prevReferenceMonth
      );
      if (result.copied === 0) {
        setMessage('Nenhum override no mês anterior.');
      } else {
        setMessage(`${result.copied} orçamento(s) copiado(s).`);
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={isPending}
        onClick={handleCopy}
      >
        <Copy className="h-3.5 w-3.5" />
        {isPending ? 'Copiando...' : 'Copiar do mês anterior'}
      </Button>
      {message && (
        <span className="text-xs text-muted-foreground">{message}</span>
      )}
    </div>
  );
}
