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
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { toast } from 'sonner';
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

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
        toast.error('Erro ao salvar. Tente novamente.');
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
            <Field label="Valor (R$)">
              <CurrencyInput name="amount" defaultValue={contribution.amount} required autoFocus />
            </Field>
            <Field label="Mês de referência">
              <Input
                name="referenceMonth"
                type="month"
                defaultValue={referenceMonthToYearMonth(contribution.referenceMonth)}
                required
              />
            </Field>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
