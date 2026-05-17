'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDisplayDate } from '@/lib/utils/date'
import { cn } from '@/lib/utils/cn'
import { TxList, TxItem } from '@/components/ui/tx-list'
import { EmptyState } from '@/components/ui/empty-state'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Progress } from '@/components/ui/progress'
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
          const groupMax = group.totalBudget || group.totalSpent || 1
          const groupPct = (group.totalSpent / groupMax) * 100
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
                className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-bg-subtle"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-small font-semibold text-text-primary">{group.name}</span>
                    <span
                      className={cn(
                        'text-small font-semibold tabular-nums',
                        over ? 'text-negative' : 'text-text-secondary'
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
                  <Progress
                    value={group.totalSpent}
                    max={groupMax}
                    className="h-1.5"
                    indicatorClassName={cn(
                      over ? 'bg-negative' : groupPct >= 85 ? 'bg-warning' : 'bg-positive'
                    )}
                  />
                </div>
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 flex-shrink-0 text-text-tertiary transition-transform duration-base',
                    isOpen && 'rotate-180'
                  )}
                />
              </button>

              {isOpen && (
                <div className="border-t border-border">
                  {group.categories.map((cat) => {
                    const noBudget = cat.budget === 0
                    const catOver = !noBudget && cat.spent > cat.budget
                    const catPct = noBudget
                      ? cat.spent > 0
                        ? 100
                        : 0
                      : (cat.spent / cat.budget) * 100

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
                        <Progress
                          value={catPct}
                          max={100}
                          className="h-1 w-12 flex-shrink-0 lg:w-20"
                          indicatorClassName={cn(
                            catOver
                              ? 'bg-negative'
                              : noBudget
                                ? 'bg-accent'
                                : catPct >= 85
                                  ? 'bg-warning'
                                  : 'bg-positive'
                          )}
                        />
                        <div className="flex-shrink-0 text-right">
                          <span
                            className={cn(
                              'text-caption font-semibold tabular-nums',
                              catOver ? 'text-negative' : 'text-text-secondary'
                            )}
                          >
                            {formatCurrency(cat.spent)}
                          </span>
                          <span className="text-caption tabular-nums text-text-tertiary">
                            {cat.budget > 0 ? ` / ${formatCurrency(cat.budget)}` : ' / —'}
                          </span>
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
