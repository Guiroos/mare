'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateGoalContribution } from '@/lib/actions/goals';
import { referenceMonthToYearMonth, yearMonthToReferenceMonth } from '@/lib/format';

type Contribution = {
  id: string;
  amount: number | string;
  referenceMonth: string;
};

export function ContributionEditButton({ contribution }: { contribution: Contribution }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.currentTarget);
    const str = (name: string) => (fd.get(name) as string) ?? '';

    startTransition(async () => {
      try {
        await updateGoalContribution({
          id: contribution.id,
          amount: str('amount'),
          referenceMonth: yearMonthToReferenceMonth(str('referenceMonth')),
        });
        setOpen(false);
      } catch {
        setError('Erro ao salvar. Tente novamente.');
      }
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        aria-label="Editar aporte"
      >
        <Pencil className="h-3 w-3" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar aporte</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-sm">Valor (R$)</Label>
              <Input
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={contribution.amount}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Mês de referência</Label>
              <Input
                name="referenceMonth"
                type="month"
                defaultValue={referenceMonthToYearMonth(contribution.referenceMonth)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
