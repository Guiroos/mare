'use client';

import { useState } from 'react';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { TxList } from '@/components/ui/tx-list';
import { EmptyState } from '@/components/ui/empty-state';
import { ChevronDown } from 'lucide-react';

type CategoryDetail = {
  id: string;
  name: string;
  budget: number;
  spent: number;
  color?: string;
  bgColor?: string;
};

type Group = {
  id: string;
  name: string;
  totalBudget: number;
  totalSpent: number;
  categories: CategoryDetail[];
};

function ProgressBar({ value, max, over }: { value: number; max: number; over: boolean }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-1.5 rounded-full overflow-hidden bg-bg-muted">
      <div
        className={cn(
          'h-full rounded-full transition-all duration-500',
          over ? 'bg-negative' : pct >= 85 ? 'bg-warning' : 'bg-positive'
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function CategoryGroupProgress({ groups }: { groups: Group[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (groups.length === 0) {
    return <EmptyState title="Nenhum grupo de categoria criado ainda." />;
  }

  return (
    <TxList>
      {groups.map((group) => {
        const over = group.totalBudget > 0 && group.totalSpent > group.totalBudget;
        const isOpen = expanded.has(group.id);

        const toggle = () => {
          setExpanded((prev) => {
            const next = new Set(prev);
            isOpen ? next.delete(group.id) : next.add(group.id);
            return next;
          });
        };

        return (
          <div key={group.id} className="border-b border-border last:border-0">
            <button
              onClick={toggle}
              className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-bg-subtle transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-small font-semibold text-text-primary">{group.name}</span>
                  <span className={cn('text-caption font-semibold tabular-nums', over ? 'text-negative-text' : 'text-text-secondary')}>
                    {formatCurrency(group.totalSpent)}
                    {group.totalBudget > 0 && (
                      <span className="font-normal text-text-tertiary">
                        {' '}/ {formatCurrency(group.totalBudget)}
                      </span>
                    )}
                  </span>
                </div>
                <ProgressBar value={group.totalSpent} max={group.totalBudget || group.totalSpent || 1} over={over} />
              </div>
              <ChevronDown
                className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0 transition-transform duration-base"
                style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>

            {isOpen && (
              <div className="border-t border-border">
                {group.categories.map((cat) => {
                  const catOver = cat.budget > 0 && cat.spent > cat.budget;
                  const catPct = cat.budget > 0 ? (cat.spent / cat.budget) * 100 : 0;

                  return (
                    <div
                      key={cat.id}
                      className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 bg-bg-surface"
                    >
                      {cat.color && (
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                      )}
                      <span className="flex-1 text-caption text-text-secondary truncate">{cat.name}</span>
                      <div className="w-20 h-1 rounded-full overflow-hidden flex-shrink-0 bg-bg-muted">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            catOver ? 'bg-negative' : catPct >= 85 ? 'bg-warning' : 'bg-positive'
                          )}
                          style={{ width: `${Math.min(catPct, 100)}%` }}
                        />
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={cn('text-caption font-semibold tabular-nums', catOver ? 'text-negative-text' : 'text-text-secondary')}>
                          {formatCurrency(cat.spent)}
                        </span>
                        {cat.budget > 0 && (
                          <span className="text-caption text-text-tertiary tabular-nums">
                            {' '}/ {formatCurrency(cat.budget)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </TxList>
  );
}
