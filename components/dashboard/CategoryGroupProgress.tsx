'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDisplayDate } from '@/lib/utils/date'
import { cn } from '@/lib/utils/cn'
import { TxList, TxItem } from '@/components/ui/tx-list'
import { EmptyState } from '@/components/ui/empty-state'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useMediaQuery } from '@/hooks/use-media-query'
import { BudgetBar } from '@/components/ui/budget-bar'
import { ChevronDown } from 'lucide-react'

type CategoryDetail = {
  id: string
  name: string
  budget: number
  spent: number
  color?: string
  bgColor?: string
}

type Group = {
  id: string
  name: string
  totalBudget: number
  totalSpent: number
  categories: CategoryDetail[]
}

type Transaction = {
  id: string
  name: string
  amount: string
  date: string
  categoryId: string | null
  category: { name: string; color?: string | null; bgColor?: string | null } | null
  account: { name: string } | null
  installmentNumber: number | null
  totalInstallments: number | null
}

type FixedExpense = {
  id: string
  name: string
  amount: string
  dueDay: number
  paid: boolean
  categoryId: string | null
  account: { name: string } | null
}

function ProgressBar({ value, max, over }: { value: number; max: number; over: boolean }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-bg-muted">
      <div
        className={cn(
          'h-full rounded-full transition-all duration-500',
          over ? 'bg-negative' : pct >= 85 ? 'bg-warning' : 'bg-positive'
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function CategoryTransactionsList({
  categoryId,
  transactions,
  fixedExpenses,
}: {
  categoryId: string
  transactions: Transaction[]
  fixedExpenses: FixedExpense[]
}) {
  const filteredTx = transactions.filter((t) => t.categoryId === categoryId)
  const filteredFe = fixedExpenses.filter((fe) => fe.categoryId === categoryId)

  if (filteredTx.length === 0 && filteredFe.length === 0) {
    return <EmptyState title="Nenhuma transação nesta categoria." />
  }

  return (
    <TxList className="max-h-[60vh] overflow-y-auto">
      {filteredFe.map((fe) => (
        <TxItem
          key={`fe-${fe.id}`}
          name={fe.name}
          meta={[fe.account?.name, 'Gasto fixo'].filter(Boolean).join(' · ')}
          amount={formatCurrency(Number(fe.amount))}
          amountTone="neg"
          strike={fe.paid}
        />
      ))}
      {filteredTx.map((tx) => (
        <TxItem
          key={`tx-${tx.id}`}
          name={tx.name}
          meta={[tx.account?.name, formatDisplayDate(tx.date)].filter(Boolean).join(' · ')}
          amount={formatCurrency(Number(tx.amount))}
          amountTone="neg"
          installment={
            tx.installmentNumber && tx.totalInstallments
              ? `${tx.installmentNumber}/${tx.totalInstallments}`
              : undefined
          }
        />
      ))}
    </TxList>
  )
}

export function CategoryGroupProgress({
  groups,
  transactions = [],
  fixedExpenses = [],
}: {
  groups: Group[]
  transactions?: Transaction[]
  fixedExpenses?: FixedExpense[]
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedCategory, setSelectedCategory] = useState<{
    id: string
    name: string
    budget: number
    spent: number
  } | null>(null)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  if (groups.length === 0) {
    return <EmptyState title="Nenhum grupo de categoria criado ainda." />
  }

  return (
    <>
      <TxList>
        {groups.map((group) => {
          const over = group.totalBudget > 0 && group.totalSpent > group.totalBudget
          const isOpen = expanded.has(group.id)

          const toggle = () => {
            setExpanded((prev) => {
              const next = new Set(prev)
              if (isOpen) next.delete(group.id)
              else next.add(group.id)
              return next
            })
          }

          return (
            <div key={group.id} className="border-b border-border last:border-0">
              <button
                onClick={toggle}
                className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-bg-subtle"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-small font-semibold text-text-primary">{group.name}</span>
                    <span
                      className={cn(
                        'text-small font-semibold tabular-nums',
                        over ? 'text-negative-text' : 'text-text-secondary'
                      )}
                    >
                      {formatCurrency(group.totalSpent)}
                      {group.totalBudget > 0 && (
                        <span className="font-normal text-text-tertiary">
                          {' '}
                          / {formatCurrency(group.totalBudget)}
                        </span>
                      )}
                    </span>
                  </div>
                  <ProgressBar
                    value={group.totalSpent}
                    max={group.totalBudget || group.totalSpent || 1}
                    over={over}
                  />
                </div>
                <ChevronDown
                  className="h-3.5 w-3.5 flex-shrink-0 text-text-tertiary transition-transform duration-base"
                  style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </button>

              {isOpen && (
                <div className="border-t border-border">
                  {group.categories.map((cat) => {
                    const catOver = cat.budget > 0 && cat.spent > cat.budget
                    const catPct = cat.budget > 0 ? (cat.spent / cat.budget) * 100 : 0

                    return (
                      <button
                        key={cat.id}
                        onClick={() =>
                          setSelectedCategory({
                            id: cat.id,
                            name: cat.name,
                            budget: cat.budget,
                            spent: cat.spent,
                          })
                        }
                        className="flex w-full items-center gap-3 border-b border-border bg-bg-surface px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-bg-subtle"
                      >
                        {cat.color && (
                          <span
                            className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                            style={{ background: cat.color }}
                          />
                        )}
                        <span className="flex-1 truncate text-caption text-text-secondary">
                          {cat.name}
                        </span>
                        <div className="h-1 w-12 flex-shrink-0 overflow-hidden rounded-full bg-bg-muted lg:w-20">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              catOver ? 'bg-negative' : catPct >= 85 ? 'bg-warning' : 'bg-positive'
                            )}
                            style={{ width: `${Math.min(catPct, 100)}%` }}
                          />
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <span
                            className={cn(
                              'text-caption font-semibold tabular-nums',
                              catOver ? 'text-negative-text' : 'text-text-secondary'
                            )}
                          >
                            {formatCurrency(cat.spent)}
                          </span>
                          {cat.budget > 0 && (
                            <span className="text-caption tabular-nums text-text-tertiary">
                              {' '}
                              / {formatCurrency(cat.budget)}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </TxList>

      {isDesktop ? (
        <Dialog
          open={!!selectedCategory}
          onOpenChange={(open) => !open && setSelectedCategory(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedCategory?.name}</DialogTitle>
            </DialogHeader>
            {selectedCategory && (
              <>
                {selectedCategory.budget > 0 ? (
                  <BudgetBar
                    current={selectedCategory.spent}
                    target={selectedCategory.budget}
                    className="px-1"
                  />
                ) : (
                  <p className="px-1 text-caption text-text-secondary">
                    Gasto:{' '}
                    <span className="font-semibold tabular-nums text-text-primary">
                      {formatCurrency(selectedCategory.spent)}
                    </span>
                  </p>
                )}
                <CategoryTransactionsList
                  categoryId={selectedCategory.id}
                  transactions={transactions}
                  fixedExpenses={fixedExpenses}
                />
              </>
            )}
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer
          open={!!selectedCategory}
          onOpenChange={(open) => !open && setSelectedCategory(null)}
        >
          <DrawerContent className="max-h-[92dvh]">
            <DrawerHeader>
              <DrawerTitle>{selectedCategory?.name}</DrawerTitle>
            </DrawerHeader>
            {selectedCategory && (
              <div className="overflow-y-auto px-4 pb-6">
                {selectedCategory.budget > 0 ? (
                  <BudgetBar
                    current={selectedCategory.spent}
                    target={selectedCategory.budget}
                    className="px-1"
                  />
                ) : (
                  <p className="px-1 text-caption text-text-secondary">
                    Gasto:{' '}
                    <span className="font-semibold tabular-nums text-text-primary">
                      {formatCurrency(selectedCategory.spent)}
                    </span>
                  </p>
                )}
                <div className="mt-4">
                  <CategoryTransactionsList
                    categoryId={selectedCategory.id}
                    transactions={transactions}
                    fixedExpenses={fixedExpenses}
                  />
                </div>
              </div>
            )}
          </DrawerContent>
        </Drawer>
      )}
    </>
  )
}
