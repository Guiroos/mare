'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DeleteButton({ onDelete }: { onDelete: () => Promise<void> }) {
  const [confirm, setConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  if (confirm) {
    return (
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="destructive"
          className="h-7 text-xs px-2"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              try {
                await onDelete();
              } catch {
                setError('Não é possível excluir — item em uso.');
                setConfirm(false);
              }
            })
          }
        >
          {isPending ? '...' : 'Excluir'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs px-2"
          onClick={() => setConfirm(false)}
        >
          Cancelar
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    );
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-7 w-7 text-muted-foreground hover:text-destructive"
      onClick={() => setConfirm(true)}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
