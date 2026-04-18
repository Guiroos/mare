'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { upsertGoal } from '@/lib/actions/goals';

type InvestmentTypeOption = { id: string; name: string };

type Props =
  | { mode: 'create'; investmentTypes: InvestmentTypeOption[] }
  | {
      mode: 'edit';
      investmentTypes: InvestmentTypeOption[];
      goal: {
        id: string;
        name: string;
        targetAmount: number;
        targetDate: string | null;
        investmentTypeId: string | null;
      };
    };

export function GoalDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const [investmentTypeId, setInvestmentTypeId] = useState(
    props.mode === 'edit' ? (props.goal.investmentTypeId ?? '') : ''
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = (fd.get('name') as string).trim();
    const targetAmount = (fd.get('targetAmount') as string).trim();
    const targetDate = (fd.get('targetDate') as string).trim() || null;

    setError('');
    startTransition(async () => {
      try {
        await upsertGoal({
          name,
          targetAmount,
          targetDate,
          investmentTypeId: investmentTypeId || null,
          existingId: props.mode === 'edit' ? props.goal.id : undefined,
        });
        setOpen(false);
      } catch {
        setError('Erro ao salvar.');
      }
    });
  };

  const defaultTargetAmount =
    props.mode === 'edit'
      ? String(props.goal.targetAmount.toFixed(2)).replace('.', ',')
      : '';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {props.mode === 'create' ? (
          <Button size="sm" variant="outline" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Nova meta
          </Button>
        ) : (
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === 'create' ? 'Nova meta financeira' : 'Editar meta'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              name="name"
              defaultValue={props.mode === 'edit' ? props.goal.name : ''}
              placeholder="Ex: Reserva de emergência, Viagem, Apartamento..."
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Valor alvo (R$)</Label>
            <Input
              name="targetAmount"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={props.mode === 'edit' ? props.goal.targetAmount : ''}
              placeholder="0,00"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Prazo (opcional)</Label>
            <Input
              name="targetDate"
              type="date"
              defaultValue={
                props.mode === 'edit' && props.goal.targetDate
                  ? props.goal.targetDate
                  : ''
              }
            />
          </div>
          {props.investmentTypes.length > 0 && (
            <div className="space-y-1.5">
              <Label>Vínculo com investimento (opcional)</Label>
              <Select value={investmentTypeId} onValueChange={setInvestmentTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem vínculo (aporte manual)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem vínculo (aporte manual)</SelectItem>
                  {props.investmentTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Se vinculada, o progresso é calculado automaticamente pelos aportes e rendimentos.
              </p>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
