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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateWithdrawal } from '@/lib/actions/investments';

type Withdrawal = {
  id: string;
  investmentTypeId: string;
  amount: number | string;
  date: string;
  notes: string | null;
};

type Props = {
  withdrawal: Withdrawal;
  investmentTypes: { id: string; name: string }[];
};

export function WithdrawalEditButton({ withdrawal, investmentTypes }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [typeId, setTypeId] = useState(withdrawal.investmentTypeId);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.currentTarget);
    const str = (name: string) => (fd.get(name) as string) ?? '';

    startTransition(async () => {
      try {
        await updateWithdrawal({
          id: withdrawal.id,
          investmentTypeId: typeId,
          amount: str('amount'),
          date: str('date'),
          notes: str('notes') || null,
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
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        aria-label="Editar resgate"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar resgate</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-sm">Tipo de investimento</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {investmentTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Valor (R$)</Label>
              <Input
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={withdrawal.amount}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Data do resgate</Label>
              <Input name="date" type="date" defaultValue={withdrawal.date} required />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Observações</Label>
              <Input name="notes" defaultValue={withdrawal.notes ?? ''} placeholder="Opcional" />
            </div>

            <p className="text-xs text-muted-foreground">
              O destino do resgate não pode ser alterado.
            </p>

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
