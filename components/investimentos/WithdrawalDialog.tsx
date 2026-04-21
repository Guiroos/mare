'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createWithdrawal, type CreateWithdrawalInput } from '@/lib/actions/investments';

type Props = {
  investmentTypes: { id: string; name: string }[];
};

export function WithdrawalDialog({ investmentTypes }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const [destination, setDestination] = useState<'income' | 'transfer'>('income');
  const [typeId, setTypeId] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = (fd.get('amount') as string).trim();
    const date = (fd.get('date') as string).trim();
    const notes = (fd.get('notes') as string).trim();

    if (!typeId) {
      setError('Selecione o tipo de investimento.');
      return;
    }

    const data: CreateWithdrawalInput = {
      investmentTypeId: typeId,
      amount,
      date,
      destination,
      notes: notes || null,
    };

    setError('');
    startTransition(async () => {
      try {
        await createWithdrawal(data);
        setOpen(false);
        setTypeId('');
        setDestination('income');
      } catch {
        setError('Erro ao registrar resgate.');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Registrar resgate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar resgate</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Tipo de investimento</Label>
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
            <Label>Valor (R$)</Label>
            <CurrencyInput name="amount" required />
          </div>
          <div className="space-y-1.5">
            <Label>Data do resgate</Label>
            <Input name="date" type="date" required />
          </div>
          <div className="space-y-1.5">
            <Label>Destino</Label>
            <Select
              value={destination}
              onValueChange={(v) => setDestination(v as 'income' | 'transfer')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Caixa (lançar como entrada)</SelectItem>
                <SelectItem value="transfer">Transferência entre investimentos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Input name="notes" placeholder="Opcional" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Salvando...' : 'Registrar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
