'use client'

import { useState, useMemo } from 'react'
import { TransactionForm } from '@/components/forms/TransactionForm'
import type { PreviewState, PrimaryType, SaidaSubType } from '@/components/forms/transaction/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BudgetBar } from '@/components/ui/budget-bar'
import { cn } from '@/lib/utils/cn'
import { formatCurrency } from '@/lib/utils/currency'

type CategorySpend = { budget: number; spent: number; name: string }

const AVATAR_PALETTE = [
  'bg-accent-subtle text-accent-text',
  'bg-positive-subtle text-positive-text',
  'bg-warning-subtle text-warning-text',
  'bg-negative-subtle text-negative-text',
] as const

const TYPE_BADGE: Record<PrimaryType, 'negative' | 'positive' | 'accent' | 'muted'> = {
  saida: 'negative',
  entrada: 'positive',
  investimento: 'accent',
  resgate: 'positive',
}

const TYPE_LABEL: Record<PrimaryType, string> = {
  saida: 'Saída',
  entrada: 'Entrada',
  investimento: 'Investimento',
  resgate: 'Resgate',
}

const SUBTYPE_LABEL: Record<SaidaSubType, string> = {
  avulsa: 'Avulsa',
  fixa: 'Fixa',
  parcelada: 'Parcelada',
}

function buildCategoryIndexMap(
  categoryGroups: { categories: { id: string }[] }[]
): Record<string, number> {
  const map: Record<string, number> = {}
  let i = 0
  for (const g of categoryGroups) {
    for (const c of g.categories) map[c.id] = i++
  }
  return map
}

function budgetTone(spent: number, budget: number): 'ok' | 'warn' | 'over' | 'accent' {
  if (budget === 0) return 'accent'
  const pct = spent / budget
  if (pct >= 1) return 'over'
  if (pct >= 0.8) return 'warn'
  return 'ok'
}

function RegistroPreviewPanel({
  state,
  categorySpends,
  currentBalance,
  categoryIndexMap,
  investmentBalances,
}: {
  state: PreviewState | null
  categorySpends: Record<string, CategorySpend>
  currentBalance: number
  categoryIndexMap: Record<string, number>
  investmentBalances: Record<string, number>
}) {
  if (!state || (!state.name && !state.amount)) {
    return (
      <Card padding="md">
        <p className="text-caption font-semibold uppercase text-text-tertiary">Saldo do mês</p>
        <p className="mt-1 text-h1 font-semibold tabular-nums text-text-primary">
          {formatCurrency(currentBalance)}
        </p>
        <p className="mt-2 text-small text-text-tertiary">
          Preencha o formulário para visualizar o lançamento
        </p>
      </Card>
    )
  }

  const amountNum = state.amount ? parseFloat(state.amount) : 0
  const isDebit =
    state.primaryType === 'saida' ||
    (state.primaryType === 'investimento' && !state.excludeFromCashFlow)
  const isCredit = state.primaryType === 'entrada' || state.primaryType === 'resgate'
  const signedAmount = isCredit ? amountNum : isDebit ? -amountNum : 0
  const projectedBalance = currentBalance + signedAmount

  const initial = (state.name || state.categoryName || '?')[0].toUpperCase()
  const avatarIdx = (categoryIndexMap[state.categoryId] ?? 0) % AVATAR_PALETTE.length
  const avatarCls = AVATAR_PALETTE[avatarIdx]

  const categoryData = state.categoryId ? categorySpends[state.categoryId] : null
  const projectedSpent = categoryData && amountNum > 0 ? categoryData.spent + amountNum : null

  const pct =
    projectedSpent !== null && categoryData && categoryData.budget > 0
      ? Math.round((projectedSpent / categoryData.budget) * 100)
      : null
  const remaining =
    projectedSpent !== null && categoryData
      ? Math.max(0, categoryData.budget - projectedSpent)
      : null

  return (
    <div className="space-y-3">
      <p className="text-caption font-semibold uppercase text-text-tertiary">Preview</p>

      {/* Transaction card */}
      <Card padding="md">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-small font-semibold',
              avatarCls
            )}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-body font-medium text-text-primary">
                {state.name || '—'}
              </p>
              {amountNum > 0 && (
                <p
                  className={cn(
                    'flex-shrink-0 text-body font-semibold tabular-nums',
                    isDebit ? 'text-negative-text' : 'text-positive-text'
                  )}
                >
                  {isDebit ? '−' : '+'} R${' '}
                  {amountNum.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              )}
            </div>
            {(state.categoryName || state.accountName) && (
              <p className="mt-0.5 truncate text-small text-text-secondary">
                {[state.categoryName, state.accountName].filter(Boolean).join(' · ')}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              <Badge variant={TYPE_BADGE[state.primaryType]}>{TYPE_LABEL[state.primaryType]}</Badge>
              {state.primaryType === 'saida' && (
                <Badge variant="muted">{SUBTYPE_LABEL[state.subType]}</Badge>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Impacto no orçamento — saída com categoria selecionada */}
      {categoryData && projectedSpent !== null && state.primaryType === 'saida' && (
        <Card padding="md">
          <p className="mb-3 text-caption font-semibold uppercase text-text-tertiary">
            Impacto no orçamento
          </p>
          <BudgetBar
            label={categoryData.name}
            current={projectedSpent}
            target={categoryData.budget}
            tone={budgetTone(projectedSpent, categoryData.budget)}
          />
          {pct !== null && remaining !== null && (
            <p className="mt-1.5 text-caption tabular-nums text-text-secondary">
              {pct}% do orçamento
              {remaining > 0 ? ` · ${formatCurrency(remaining)} restante` : ' · limite atingido'}
            </p>
          )}
        </Card>
      )}

      {/* Novo total aportado / Saldo restante — investimento e resgate */}
      {(state.primaryType === 'investimento' || state.primaryType === 'resgate') &&
        state.investmentTypeId &&
        amountNum > 0 && (
          <Card padding="md">
            <p className="mb-1 text-caption font-semibold uppercase text-text-tertiary">
              {state.primaryType === 'investimento' ? 'Novo total aportado' : 'Saldo restante'}
            </p>
            <p className="text-h1 font-semibold tabular-nums text-text-primary">
              {formatCurrency(
                state.primaryType === 'investimento'
                  ? (investmentBalances[state.investmentTypeId] ?? 0) + amountNum
                  : (investmentBalances[state.investmentTypeId] ?? 0) - amountNum
              )}
            </p>
            <p className="mt-0.5 text-small text-text-secondary">{state.investmentTypeName}</p>
          </Card>
        )}

      {/* Saldo após lançamento */}
      {amountNum > 0 && (isDebit || isCredit) && (
        <Card padding="md">
          <p className="mb-1 text-caption font-semibold uppercase text-text-tertiary">
            Saldo após lançamento
          </p>
          <p className="text-h1 font-semibold tabular-nums text-text-primary">
            {formatCurrency(projectedBalance)}
          </p>
          <p
            className={cn(
              'mt-0.5 text-small tabular-nums',
              isDebit ? 'text-negative-text' : 'text-positive-text'
            )}
          >
            {isDebit ? '−' : '+'} {formatCurrency(amountNum)} de {formatCurrency(currentBalance)}
          </p>
        </Card>
      )}
    </div>
  )
}

type FormDataType = Awaited<
  ReturnType<typeof import('@/lib/actions/form-data').getRegistrationFormData>
>

export function RegistroPageClient({ formData }: { formData: FormDataType }) {
  const [previewState, setPreviewState] = useState<PreviewState | null>(null)

  const categoryIndexMap = useMemo(
    () => buildCategoryIndexMap(formData.categoryGroups),
    [formData.categoryGroups]
  )

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex-1">
        <Card padding="lg">
          <TransactionForm
            categoryGroups={formData.categoryGroups}
            accounts={formData.accounts}
            investmentTypes={formData.investmentTypes}
            people={formData.people}
            onFormChange={setPreviewState}
            categoryVariant="combobox"
          />
        </Card>
      </div>
      <div className="hidden w-72 flex-shrink-0 flex-col gap-4 lg:flex">
        <RegistroPreviewPanel
          state={previewState}
          categorySpends={formData.categorySpends}
          currentBalance={formData.currentBalance}
          categoryIndexMap={categoryIndexMap}
          investmentBalances={formData.investmentBalances}
        />
      </div>
    </div>
  )
}
