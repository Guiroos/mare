'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { upsertInvestment, type UpsertInvestmentInput } from '@/lib/actions/investments';
import { formatMonth, referenceMonthToYearMonth, currentYearMonth } from '@/lib/format';

type Existing = {
  id: string;
  amount: number | null;
  yieldAmount: number | null;
  notes: string | null;
  referenceMonth: string;
};

type Props = {
  investmentTypeId: string;
  existing?: Existing;
};

export function InvestmentEntryDialog({ investmentTypeId, existing }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const defaultMonth = existing
    ? referenceMonthToYearMonth(existing.referenceMonth)
    : currentYearMonth();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = (fd.get('amount') as string).trim();
    const yieldAmount = (fd.get('yieldAmount') as string).trim();
    const notes = (fd.get('notes') as string).trim();
    const selectedMonth = (fd.get('referenceMonth') as string).trim();

    const data: UpsertInvestmentInput = {
      investmentTypeId,
      referenceMonth: selectedMonth + '-01',
      amount: amount || null,
      yieldAmount: yieldAmount || null,
      notes: notes || null,
      existingId: existing?.id,
    };

    setError('');
    startTransition(async () => {
      try {
        await upsertInvestment(data);
        setOpen(false);
      } catch {
        setError('Erro ao salvar.');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existing ? (
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs">
            <Plus className="h-3 w-3" />
            Registrar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {existing ? 'Editar registro' : 'Novo registro'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Mês de referência</Label>
            <input
              name="referenceMonth"
              type="month"
              defaultValue={defaultMonth}
              required
              disabled={!!existing}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            />
            {!!existing && (
              <input type="hidden" name="referenceMonth" value={defaultMonth} />
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Aporte (R$)</Label>
            <Input
              name="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              defaultValue={existing?.amount ?? ''}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Rendimento líquido (R$)</Label>
            <Input
              name="yieldAmount"
              type="number"
              step="0.01"
              placeholder="0,00"
              defaultValue={existing?.yieldAmount ?? ''}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Input
              name="notes"
              placeholder="Opcional"
              defaultValue={existing?.notes ?? ''}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
