'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateIncome } from '@/lib/actions/incomes';
import { useMediaQuery } from '@/hooks/use-media-query';

type Income = {
  id: string;
  source: string;
  amount: string;
};

function EditForm({
  income,
  onSuccess,
}: {
  income: Income;
  onSuccess: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.currentTarget);
    const str = (name: string) => (fd.get(name) as string) ?? '';

    startTransition(async () => {
      try {
        await updateIncome({
          id: income.id,
          source: str('source'),
          amount: str('amount'),
        });
        onSuccess();
      } catch {
        setError('Erro ao salvar. Tente novamente.');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-sm">Origem</Label>
        <Input name="source" defaultValue={income.source} required />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Valor</Label>
        <Input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={income.amount}
          required
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Salvando...' : 'Salvar alterações'}
      </Button>
    </form>
  );
}

export function IncomeEditButton({ income }: { income: Income }) {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const content = <EditForm income={income} onSuccess={() => setOpen(false)} />;

  if (isDesktop) {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(true)}
          aria-label="Editar"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Editar entrada</DialogTitle>
            </DialogHeader>
            {content}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        aria-label="Editar"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Editar entrada</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">{content}</div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
