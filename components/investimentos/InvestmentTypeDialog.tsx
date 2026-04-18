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
import { createInvestmentType, updateInvestmentType } from '@/lib/actions/investments';

type Props =
  | { mode: 'create' }
  | { mode: 'edit'; type: { id: string; name: string } };

export function InvestmentTypeDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = (new FormData(e.currentTarget).get('name') as string).trim();
    setError('');
    startTransition(async () => {
      try {
        if (props.mode === 'create') {
          await createInvestmentType(name);
        } else {
          await updateInvestmentType(props.type.id, name);
        }
        setOpen(false);
      } catch {
        setError('Erro ao salvar.');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {props.mode === 'create' ? (
          <Button size="sm" variant="outline" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Novo tipo
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
            {props.mode === 'create' ? 'Novo tipo de investimento' : 'Editar tipo'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              name="name"
              defaultValue={props.mode === 'edit' ? props.type.name : ''}
              placeholder="Ex: Reserva de emergência, Renda fixa..."
              required
              autoFocus
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
