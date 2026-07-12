'use client'

import { useState, useEffect, useTransition, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Segment } from '@/components/ui/segment'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils/cn'
import { currentYearMonth, todayISOString } from '@/lib/utils/date'
import {
  createTransaction,
  createFixedExpense,
  createInstallmentPurchase,
  updateTransaction,
  updateFixedExpense,
} from '@/lib/actions/transactions'
import { toast } from 'sonner'
import { createIncome, updateIncome } from '@/lib/actions/incomes'
import { upsertInvestment, createWithdrawal } from '@/lib/actions/investments'
import {
  transactionSchema,
  fixedExpenseSchema,
  fixedExpenseEditSchema,
  installmentSchema,
  incomeSchema,
  incomeEditSchema,
} from '@/lib/validations/transactions'
import { investmentEntrySchema, withdrawalSchema } from '@/lib/validations/investments'
import { formatZodErrors } from '@/lib/validations/utils'
import { HeroAmountCard } from './transaction/HeroAmountCard'
import { SaidaConditionalFields } from './transaction/SaidaConditionalFields'
import { EntradaFields } from './transaction/EntradaFields'
import { InvestimentoFields } from './transaction/InvestimentoFields'
import { ResgateFields } from './transaction/ResgateFields'
import { CategoryPicker } from './transaction/CategoryPicker'
import { SplitSection } from './transaction/SplitSection'
import type {
  Account,
  CategoryGroup,
  EditContext,
  InvestmentType,
  PrimaryType,
  SaidaSubType,
} from './transaction/types'
import type { TransactionSplit } from '@/lib/actions/transactions'

type FormType = 'avulso' | 'fixo' | 'parcelado' | 'entrada' | 'investimento' | 'resgate'

type Person = { id: string; name: string }

type Props = {
  categoryGroups: CategoryGroup[]
  accounts: Account[]
  investmentTypes?: InvestmentType[]
  people?: Person[]
  defaultMonth?: string
  defaultDate?: string
  onSuccess?: () => void
  onFormChange?: (state: import('./transaction/types').PreviewState) => void
  categoryVariant?: 'grid' | 'select' | 'combobox'
  mode?: 'create' | 'edit'
  editContext?: EditContext
}

const PRIMARY_TYPES: { value: PrimaryType; label: string; icon?: LucideIcon }[] = [
  { value: 'saida', label: 'Saída', icon: ArrowDown },
  { value: 'entrada', label: 'Entrada', icon: ArrowUp },
  { value: 'investimento', label: 'Investimento', icon: TrendingUp },
  { value: 'resgate', label: 'Resgate' },
]

const typeSegActiveText: Record<PrimaryType, string> = {
  saida: 'text-negative-text',
  entrada: 'text-positive-text',
  investimento: 'text-accent-text',
  resgate: 'text-positive-text',
}

const submitLabel: Record<PrimaryType, string> = {
  saida: 'Salvar saída',
  entrada: 'Registrar entrada',
  investimento: 'Registrar investimento',
  resgate: 'Registrar resgate',
}

const primaryTypeContextLabel: Record<PrimaryType, string> = {
  saida: 'saída',
  entrada: 'entrada',
  investimento: 'investimento',
  resgate: 'resgate',
}

export function TransactionForm({
  categoryGroups,
  accounts,
  investmentTypes = [],
  people = [],
  defaultMonth,
  defaultDate,
  onSuccess,
  onFormChange,
  categoryVariant = 'combobox',
  mode = 'create',
  editContext,
}: Props) {
  const month = defaultMonth ?? currentYearMonth()
  const today = defaultDate ?? todayISOString()
  const isEdit = mode === 'edit'

  const [primaryType, setPrimaryType] = useState<PrimaryType>(editContext?.primaryType ?? 'saida')
  const [subType, setSubType] = useState<SaidaSubType>(editContext?.subType ?? 'avulsa')
  const [isPending, startTransition] = useTransition()
  const [key, setKey] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [categoryId, setCategoryId] = useState(editContext?.initialValues.categoryId ?? '')
  const [accountId, setAccountId] = useState(editContext?.initialValues.accountId ?? '')
  const [investmentTypeId, setInvestmentTypeId] = useState('')
  const [destination, setDestination] = useState('')
  const [previewName, setPreviewName] = useState(
    editContext?.initialValues.name ?? editContext?.initialValues.source ?? ''
  )
  const [previewAmount, setPreviewAmount] = useState('')
  const [installments, setInstallments] = useState(2)
  const [isPaid, setIsPaid] = useState(false)
  const [excludeFromCashFlow, setExcludeFromCashFlow] = useState(false)
  const [splits, setSplits] = useState<TransactionSplit[]>([])
  const [splitIntegral, setSplitIntegral] = useState(false)

  const totalCents = Math.round(parseFloat(previewAmount || '0') * 100)
  const totalSplitCents = splits.reduce((s, e) => s + Math.round(parseFloat(e.amount) * 100), 0)
  const yourShareCents = Math.max(0, totalCents - totalSplitCents)
  const effectivePreviewAmount =
    splitIntegral && splits.length > 0 ? (yourShareCents / 100).toFixed(2) : previewAmount

  const resetForm = () => {
    setKey((k) => k + 1)
    setErrors({})
    setCategoryId('')
    setAccountId('')
    setInvestmentTypeId('')
    setDestination('')
    setPreviewName('')
    setPreviewAmount('')
    setInstallments(2)
    setIsPaid(false)
    setExcludeFromCashFlow(false)
    setSplits([])
    setSplitIntegral(false)
  }

  useEffect(() => {
    if (!onFormChange) return
    const cat = categoryGroups.flatMap((g) => g.categories).find((c) => c.id === categoryId)
    const acc = accounts.find((a) => a.id === accountId)
    onFormChange({
      primaryType,
      subType,
      name: previewName,
      amount: effectivePreviewAmount,
      categoryId,
      categoryName: cat?.name ?? '',
      accountId,
      accountName: acc?.name ?? '',
      excludeFromCashFlow,
    })
  }, [
    primaryType,
    subType,
    categoryId,
    accountId,
    previewName,
    previewAmount,
    effectivePreviewAmount,
    excludeFromCashFlow,
    onFormChange,
    categoryGroups,
    accounts,
  ])

  function resolvedFormType(): FormType {
    if (primaryType === 'entrada') return 'entrada'
    if (primaryType === 'investimento') return 'investimento'
    if (primaryType === 'resgate') return 'resgate'
    if (subType === 'fixa') return 'fixo'
    if (subType === 'parcelada') return 'parcelado'
    return 'avulso'
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const str = (name: string) => (fd.get(name) as string) ?? ''
    const type = resolvedFormType()

    if (isEdit && editContext) {
      if (editContext.primaryType === 'entrada') {
        const result = incomeEditSchema.safeParse({ source: str('source'), amount: str('amount') })
        if (!result.success) {
          setErrors(formatZodErrors(result.error))
          return
        }
        setErrors({})
        startTransition(async () => {
          try {
            await updateIncome({ id: editContext.entityId, ...result.data })
            onSuccess?.()
          } catch {
            toast.error('Erro ao salvar. Tente novamente.')
          }
        })
        return
      }
      if (editContext.subType === 'fixa') {
        const result = fixedExpenseEditSchema.safeParse({
          name: str('name'),
          amount: str('amount'),
          dueDay: str('dueDay'),
          categoryId,
          accountId,
        })
        if (!result.success) {
          setErrors(formatZodErrors(result.error))
          return
        }
        setErrors({})
        startTransition(async () => {
          try {
            await updateFixedExpense({
              id: editContext.entityId,
              name: result.data.name,
              amount: result.data.amount,
              dueDay: Number(result.data.dueDay),
              categoryId: result.data.categoryId,
              accountId: result.data.accountId,
            })
            onSuccess?.()
          } catch {
            toast.error('Erro ao salvar. Tente novamente.')
          }
        })
        return
      }
      // saída avulsa
      const result = transactionSchema.safeParse({
        name: str('name'),
        amount: str('amount'),
        date: str('date'),
        categoryId,
        accountId,
      })
      if (!result.success) {
        setErrors(formatZodErrors(result.error))
        return
      }
      setErrors({})
      startTransition(async () => {
        try {
          await updateTransaction({ id: editContext.entityId, ...result.data })
          onSuccess?.()
        } catch {
          toast.error('Erro ao salvar. Tente novamente.')
        }
      })
      return
    }

    if (type === 'avulso') {
      const amountToUse =
        splitIntegral && splits.length > 0 ? effectivePreviewAmount : str('amount')
      const result = transactionSchema.safeParse({
        name: str('name'),
        amount: amountToUse,
        date: str('date'),
        categoryId,
        accountId,
      })
      if (!result.success) {
        setErrors(formatZodErrors(result.error))
        return
      }
      setErrors({})
      startTransition(async () => {
        try {
          await createTransaction({
            ...result.data,
            splits: splits.length > 0 ? splits : undefined,
          })
          resetForm()
          onSuccess?.()
        } catch {
          toast.error('Erro ao salvar. Tente novamente.')
        }
      })
    } else if (type === 'fixo') {
      const result = fixedExpenseSchema.safeParse({
        name: str('name'),
        amount: str('amount'),
        dueDay: str('dueDay'),
        categoryId,
        accountId,
        referenceMonth: str('referenceMonth'),
      })
      if (!result.success) {
        setErrors(formatZodErrors(result.error))
        return
      }
      setErrors({})
      startTransition(async () => {
        try {
          await createFixedExpense({
            name: result.data.name,
            amount: result.data.amount,
            dueDay: Number(result.data.dueDay),
            categoryId: result.data.categoryId,
            accountId: result.data.accountId,
            referenceMonth: result.data.referenceMonth + '-01',
          })
          resetForm()
          onSuccess?.()
        } catch {
          toast.error('Erro ao salvar. Tente novamente.')
        }
      })
    } else if (type === 'parcelado') {
      const totalAmountToUse =
        splitIntegral && splits.length > 0 ? effectivePreviewAmount : str('totalAmount')
      const result = installmentSchema.safeParse({
        name: str('name'),
        totalAmount: totalAmountToUse,
        totalInstallments: String(installments),
        startDate: str('startDate'),
        categoryId,
        accountId,
      })
      if (!result.success) {
        setErrors(formatZodErrors(result.error))
        return
      }
      setErrors({})
      startTransition(async () => {
        try {
          await createInstallmentPurchase({
            name: result.data.name,
            totalAmount: result.data.totalAmount,
            totalInstallments: Number(result.data.totalInstallments),
            startDate: result.data.startDate,
            categoryId: result.data.categoryId,
            accountId: result.data.accountId,
            splits: splits.length > 0 ? splits : undefined,
          })
          resetForm()
          onSuccess?.()
        } catch {
          toast.error('Erro ao salvar. Tente novamente.')
        }
      })
    } else if (type === 'entrada') {
      const result = incomeSchema.safeParse({
        source: str('source'),
        amount: str('amount'),
        referenceMonth: str('referenceMonth'),
      })
      if (!result.success) {
        setErrors(formatZodErrors(result.error))
        return
      }
      setErrors({})
      startTransition(async () => {
        try {
          await createIncome({
            source: result.data.source,
            amount: result.data.amount,
            referenceMonth: result.data.referenceMonth + '-01',
          })
          resetForm()
          onSuccess?.()
        } catch {
          toast.error('Erro ao salvar. Tente novamente.')
        }
      })
    } else if (type === 'investimento') {
      const result = investmentEntrySchema.safeParse({
        investmentTypeId,
        referenceMonth: str('referenceMonth'),
        amount: str('amount') || undefined,
        yieldAmount: str('yieldAmount') || undefined,
      })
      if (!result.success) {
        setErrors(formatZodErrors(result.error))
        return
      }
      setErrors({})
      startTransition(async () => {
        try {
          await upsertInvestment({
            investmentTypeId: result.data.investmentTypeId,
            referenceMonth: result.data.referenceMonth + '-01',
            amount: str('amount') || null,
            yieldAmount: str('yieldAmount') || null,
            notes: str('notes') || null,
            excludeFromCashFlow,
          })
          resetForm()
          onSuccess?.()
        } catch {
          toast.error('Erro ao salvar. Tente novamente.')
        }
      })
    } else if (type === 'resgate') {
      const result = withdrawalSchema.safeParse({
        investmentTypeId,
        amount: str('amount'),
        date: str('date'),
        destination,
      })
      if (!result.success) {
        setErrors(formatZodErrors(result.error))
        return
      }
      setErrors({})
      startTransition(async () => {
        try {
          const typeName =
            investmentTypes.find((t) => t.id === result.data.investmentTypeId)?.name ?? ''
          await createWithdrawal({
            investmentTypeId: result.data.investmentTypeId,
            investmentTypeName: typeName,
            amount: result.data.amount,
            date: result.data.date,
            destination: result.data.destination,
            notes: str('notes') || null,
          })
          resetForm()
          onSuccess?.()
        } catch {
          toast.error('Erro ao salvar. Tente novamente.')
        }
      })
    }
  }

  const resolvedType = resolvedFormType()

  return (
    <div className="space-y-5">
      {isEdit ? (
        <div
          className={cn(
            'rounded-md px-3 py-2 text-caption font-semibold',
            typeSegActiveText[primaryType]
          )}
        >
          {`Editando ${primaryTypeContextLabel[primaryType]}`}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Segment
            options={PRIMARY_TYPES.map((pt) => ({
              value: pt.value,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  {pt.icon && <pt.icon className="h-3.5 w-3.5" />}
                  {pt.label}
                </span>
              ),
              activeClassName: cn('font-semibold', typeSegActiveText[pt.value]),
            }))}
            value={primaryType}
            onChange={(v) => {
              setPrimaryType(v)
              resetForm()
            }}
            className="flex w-full min-w-max"
          />
        </div>
      )}

      <form key={key} onSubmit={handleSubmit} className="space-y-4">
        <HeroAmountCard
          primaryType={primaryType}
          resolvedType={resolvedType}
          subType={subType}
          onSubTypeChange={setSubType}
          onValueChange={(cents) => setPreviewAmount((cents / 100).toFixed(2))}
          errors={errors}
          defaultAmount={editContext?.initialValues.amount}
          lockSubType={isEdit}
        />

        {/* Nome / Origem */}
        {(primaryType === 'saida' || primaryType === 'entrada') && (
          <Field
            label={primaryType === 'entrada' ? 'Origem' : 'Nome'}
            error={errors.name ?? errors.source}
          >
            <Input
              name={primaryType === 'entrada' ? 'source' : 'name'}
              defaultValue={editContext?.initialValues.name ?? editContext?.initialValues.source}
              placeholder={
                primaryType === 'entrada' ? 'Ex: Salário, Vale...' : 'Ex: Mercado, Netflix...'
              }
              error={!!(errors.name ?? errors.source)}
              onChange={(e) => setPreviewName(e.target.value)}
            />
          </Field>
        )}

        {/* Tipo de investimento */}
        {(primaryType === 'investimento' || primaryType === 'resgate') && (
          <Field label="Tipo de investimento" error={errors.investmentTypeId}>
            <Select value={investmentTypeId} onValueChange={setInvestmentTypeId}>
              <SelectTrigger error={!!errors.investmentTypeId}>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {investmentTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {/* Campos condicionais por tipo */}
        {primaryType === 'saida' && (
          <SaidaConditionalFields
            resolvedType={resolvedType as 'avulso' | 'fixo' | 'parcelado'}
            errors={errors}
            month={month}
            today={today}
            installments={installments}
            onInstallmentsChange={setInstallments}
            previewAmount={previewAmount}
            isPaid={isPaid}
            onIsPaidChange={setIsPaid}
            defaultDate={editContext?.initialValues.date}
            defaultDueDay={editContext?.initialValues.dueDay}
            accountField={
              <Field label="Conta / Cartão" error={errors.accountId}>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger error={!!errors.accountId}>
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            }
          />
        )}
        {resolvedType === 'entrada' && <EntradaFields errors={errors} month={month} />}
        {resolvedType === 'investimento' && (
          <InvestimentoFields
            errors={errors}
            month={month}
            excludeFromCashFlow={excludeFromCashFlow}
            onExcludeChange={setExcludeFromCashFlow}
          />
        )}
        {resolvedType === 'resgate' && (
          <ResgateFields
            errors={errors}
            today={today}
            destination={destination}
            onDestinationChange={setDestination}
          />
        )}

        {/* Categoria */}
        {primaryType === 'saida' && (
          <CategoryPicker
            categoryGroups={categoryGroups}
            categoryId={categoryId}
            onCategoryChange={setCategoryId}
            error={errors.categoryId}
            variant={categoryVariant}
          />
        )}

        {/* Dividir com devedores — apenas saída avulsa e parcelada */}
        {!isEdit &&
          primaryType === 'saida' &&
          (resolvedType === 'avulso' || resolvedType === 'parcelado') &&
          people.length > 0 && (
            <SplitSection
              people={people}
              totalCents={Math.round(parseFloat(previewAmount || '0') * 100)}
              onChange={setSplits}
              onIntegralChange={setSplitIntegral}
            />
          )}

        <div className="pt-1">
          <Button type="submit" className="w-full" loading={isPending}>
            {isEdit ? 'Salvar alterações' : submitLabel[primaryType]}
          </Button>
        </div>
      </form>
    </div>
  )
}
