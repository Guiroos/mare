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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createCategory, updateCategory } from '@/lib/actions/categories';

type Group = { id: string; name: string };

type BaseProps = { groups: Group[] };
type CreateProps = BaseProps & { mode: 'create'; defaultGroupId: string };
type EditProps = BaseProps & {
  mode: 'edit';
  category: {
    id: string;
    name: string;
    groupId: string;
    defaultBudget: string | null;
  };
};

type Props = CreateProps | EditProps;

export function CategoryDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const defaultGroupId =
    props.mode === 'create' ? props.defaultGroupId : props.category.groupId;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError('');
    startTransition(async () => {
      try {
        const data = {
          name: (fd.get('name') as string).trim(),
          groupId: fd.get('groupId') as string,
          defaultBudget: (fd.get('defaultBudget') as string) || undefined,
        };
        if (props.mode === 'create') {
          await createCategory(data);
        } else {
          await updateCategory(props.category.id, data);
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
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs text-muted-foreground"
          >
            <Plus className="h-3 w-3" />
            Categoria
          </Button>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === 'create' ? 'Nova categoria' : 'Editar categoria'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              name="name"
              defaultValue={
                props.mode === 'edit' ? props.category.name : ''
              }
              placeholder="Ex: Mercado, Academia..."
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Grupo</Label>
            <Select name="groupId" defaultValue={defaultGroupId} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o grupo" />
              </SelectTrigger>
              <SelectContent>
                {props.groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>
              Orçamento padrão{' '}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              name="defaultBudget"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              defaultValue={
                props.mode === 'edit'
                  ? (props.category.defaultBudget ?? '')
                  : ''
              }
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
