'use client';

import { useTransition } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reorderCategoryGroups } from '@/lib/actions/categories';

type Props = {
  groupId: string;
  allGroupIds: string[];
};

export function ReorderButtons({ groupId, allGroupIds }: Props) {
  const [isPending, startTransition] = useTransition();
  const index = allGroupIds.indexOf(groupId);
  const isFirst = index === 0;
  const isLast = index === allGroupIds.length - 1;

  const move = (direction: 'up' | 'down') => {
    const newOrder = [...allGroupIds];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
    startTransition(() => reorderCategoryGroups(newOrder));
  };

  return (
    <div className="flex flex-col">
      <Button
        size="icon"
        variant="ghost"
        className="h-4 w-7 text-muted-foreground rounded-b-none"
        disabled={isFirst || isPending}
        onClick={() => move('up')}
        aria-label="Mover para cima"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-4 w-7 text-muted-foreground rounded-t-none"
        disabled={isLast || isPending}
        onClick={() => move('down')}
        aria-label="Mover para baixo"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
