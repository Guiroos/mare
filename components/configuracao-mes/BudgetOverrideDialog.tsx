'use client';

import { useState, useTransition } from 'react';
import { Pencil, RotateCcw } from 'lucide-react';
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
import {
  upsertBudgetOverride,
  deleteBudgetOverride,
} from '@/lib/actions/categories';

type Props = {
  categoryId: string;
  categoryName: string;
  referenceMonth: string;
  defaultBudget: string | null;
  override: { id: string; amount: string } | null;
};

export function BudgetOverrideDialog({
  categoryId,
  categoryName,
  referenceMonth,
  defaultBudget,
  override,
}: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const amount = new FormData(e.currentTarget).get('amount') as string;
    setError('');
    startTransition(async () => {
      try {
        await upsertBudgetOverride({
          categoryId,
          referenceMonth,
          amount,
          existingId: override?.id,
        });
        setOpen(false);
      } catch {
        setError('Erro ao salvar.');
      }
    });
  };

  const handleReset = () => {
    if (!override) return;
    startTransition(async () => {
      try {
        await deleteBudgetOverride(override.id);
        setOpen(false);
      } catch {
        setError('Erro ao remover.');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-muted-foreground"
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Orçamento de {categoryName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {defaultBudget && (
            <p className="text-sm text-muted-foreground">
              Padrão: <strong>{Number(defaultBudget).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Orçamento deste mês</Label>
            <Input
              name="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              defaultValue={override?.amount ?? defaultBudget ?? ''}
              required
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={isPending}>
              {isPending ? 'Salvando...' : 'Definir'}
            </Button>
            {override && (
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                disabled={isPending}
                onClick={handleReset}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Usar padrão
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
