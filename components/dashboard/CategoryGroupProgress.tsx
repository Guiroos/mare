import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

type CategoryDetail = {
  id: string;
  name: string;
  budget: number;
  spent: number;
};

type Group = {
  id: string;
  name: string;
  totalBudget: number;
  totalSpent: number;
  categories: CategoryDetail[];
};

export function CategoryGroupProgress({ groups }: { groups: Group[] }) {
  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhum grupo de categoria criado ainda.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const pct =
          group.totalBudget > 0
            ? (group.totalSpent / group.totalBudget) * 100
            : 0;
        const over = pct > 100;

        return (
          <details key={group.id} className="rounded-xl border bg-card">
            <summary className="flex cursor-pointer items-center gap-4 p-4 select-none list-none [&::-webkit-details-marker]:hidden">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium truncate">{group.name}</span>
                  <span className={cn('text-xs font-medium', over ? 'text-red-600' : 'text-muted-foreground')}>
                    {formatCurrency(group.totalSpent)}
                    {group.totalBudget > 0 && (
                      <span className="text-muted-foreground font-normal">
                        {' '}/ {formatCurrency(group.totalBudget)}
                      </span>
                    )}
                  </span>
                </div>
                <Progress
                  value={group.totalSpent}
                  max={group.totalBudget || group.totalSpent || 1}
                  indicatorClassName={over ? 'bg-red-500' : undefined}
                />
              </div>
            </summary>

            <div className="border-t divide-y">
              {group.categories.map((cat) => {
                const catPct =
                  cat.budget > 0 ? (cat.spent / cat.budget) * 100 : 0;
                const catOver = catPct > 100;

                return (
                  <div key={cat.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-sm text-muted-foreground flex-1 truncate">
                      {cat.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-xs font-medium', catOver ? 'text-red-600' : '')}>
                        {formatCurrency(cat.spent)}
                      </span>
                      {cat.budget > 0 && (
                        <span className="text-xs text-muted-foreground">
                          / {formatCurrency(cat.budget)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}
