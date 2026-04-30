'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { currentYearMonth, todayISOString } from '@/lib/utils/date'
import {
  createTransaction,
  createFixedExpense,
  createInstallmentPurchase,
} from '@/lib/actions/transactions'
import { toast } from 'sonner'
import { createIncome } from '@/lib/actions/incomes'
import { upsertInvestment, createWithdrawal } from '@/lib/actions/investments'
import {
  transactionSchema,
  fixedExpenseSchema,
  installmentSchema,
  incomeSchema,
} from '@/lib/validations/transactions'
import { investmentEntrySchema, withdrawalSchema } from '@/lib/validations/investments'
import { formatZodErrors } from '@/lib/validations/utils'

type CategoryGroup = {
  id: string
  name: string
  categories: { id: string; name: string }[]
}

type Account = {
  id: string
  name: string
  type: string
}

type FormType = 'avulso' | 'fixo' | 'parcelado' | 'entrada' | 'investimento' | 'resgate'

const TABS: { value: FormType; label: string }[] = [
  { value: 'avulso', label: 'Gasto avulso' },
  { value: 'fixo', label: 'Gasto fixo' },
  { value: 'parcelado', label: 'Parcelado' },
  { value: 'entrada', label: 'Entrada' },
  { value: 'investimento', label: 'Investimento' },
  { value: 'resgate', label: 'Resgate' },
]

type InvestmentType = {
  id: string
  name: string
}

type Props = {
  categoryGroups: CategoryGroup[]
  accounts: Account[]
  investmentTypes?: InvestmentType[]
  defaultMonth?: string
  onSuccess?: () => void
  showFullPageLink?: boolean
}

export function TransactionForm({
  categoryGroups,
  accounts,
  investmentTypes = [],
  defaultMonth,
  onSuccess,
  showFullPageLink = false,
}: Props) {
  const month = defaultMonth ?? currentYearMonth()
  const today = todayISOString()

  const [type, setType] = useState<FormType>('avulso')
  const [isPending, startTransition] = useTransition()
  const [key, setKey] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const resetForm = () => {
    setKey((k) => k + 1)
    setErrors({})
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const str = (name: string) => (fd.get(name) as string) ?? ''

    if (type === 'avulso') {
      const result = transactionSchema.safeParse({
        name: str('name'),
        amount: str('amount'),
        date: str('date'),
        categoryId: str('categoryId'),
        accountId: str('accountId'),
      })
      if (!result.success) {
        setErrors(formatZodErrors(result.error))
        return
      }
      setErrors({})
      startTransition(async () => {
        try {
          await createTransaction(result.data)
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
        categoryId: str('categoryId'),
        accountId: str('accountId'),
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
      const result = installmentSchema.safeParse({
        name: str('name'),
        totalAmount: str('totalAmount'),
        totalInstallments: str('totalInstallments'),
        startDate: str('startDate'),
        categoryId: str('categoryId'),
        accountId: str('accountId'),
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
        investmentTypeId: str('investmentTypeId'),
        referenceMonth: str('referenceMonth'),
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
          })
          resetForm()
          onSuccess?.()
        } catch {
          toast.error('Erro ao salvar. Tente novamente.')
        }
      })
    } else if (type === 'resgate') {
      const result = withdrawalSchema.safeParse({
        investmentTypeId: str('investmentTypeId'),
        amount: str('amount'),
        date: str('date'),
        destination: str('destination'),
      })
      if (!result.success) {
        setErrors(formatZodErrors(result.error))
        return
      }
      setErrors({})
      startTransition(async () => {
        try {
          await createWithdrawal({
            investmentTypeId: result.data.investmentTypeId,
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

  const isExpense = type !== 'entrada' && type !== 'investimento' && type !== 'resgate'

  return (
    <div className="space-y-5">
      {/* Tipo */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <Chip
            key={tab.value}
            active={type === tab.value}
            onClick={() => {
              setType(tab.value)
              resetForm()
            }}
          >
            {tab.label}
          </Chip>
        ))}
      </div>

      <form key={key} onSubmit={handleSubmit} className="space-y-4">
        {/* Nome / Origem */}
        {(type === 'avulso' || type === 'fixo' || type === 'parcelado' || type === 'entrada') && (
          <Field
            label={type === 'entrada' ? 'Origem' : 'Nome'}
            error={errors.name ?? errors.source}
          >
            <Input
              name={type === 'entrada' ? 'source' : 'name'}
              placeholder={type === 'entrada' ? 'Ex: Salário, Vale...' : 'Ex: Mercado, Netflix...'}
              error={!!(errors.name ?? errors.source)}
              autoFocus
            />
          </Field>
        )}

        {/* Tipo de investimento */}
        {(type === 'investimento' || type === 'resgate') && (
          <Field label="Tipo de investimento" error={errors.investmentTypeId}>
            <Select name="investmentTypeId" required>
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

        {/* Valor */}
        {type !== 'investimento' && (
          <Field
            label={type === 'parcelado' ? 'Valor total' : 'Valor'}
            error={errors.amount ?? errors.totalAmount}
          >
            <CurrencyInput
              name={type === 'parcelado' ? 'totalAmount' : 'amount'}
              error={!!(errors.amount ?? errors.totalAmount)}
              required
            />
          </Field>
        )}

        {/* Campos por tipo */}
        {type === 'avulso' && (
          <Field label="Data" error={errors.date}>
            <Input name="date" type="date" defaultValue={today} error={!!errors.date} required />
          </Field>
        )}

        {type === 'fixo' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dia de vencimento" error={errors.dueDay}>
              <Input
                name="dueDay"
                type="number"
                min="1"
                max="31"
                placeholder="Ex: 10"
                error={!!errors.dueDay}
                required
              />
            </Field>
            <Field label="Mês de referência" error={errors.referenceMonth}>
              <Input
                name="referenceMonth"
                type="month"
                defaultValue={month}
                error={!!errors.referenceMonth}
                required
              />
            </Field>
          </div>
        )}

        {type === 'parcelado' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nº de parcelas" error={errors.totalInstallments}>
              <Input
                name="totalInstallments"
                type="number"
                min="2"
                max="60"
                placeholder="Ex: 12"
                error={!!errors.totalInstallments}
                required
              />
            </Field>
            <Field label="Data da 1ª parcela" error={errors.startDate}>
              <Input
                name="startDate"
                type="date"
                defaultValue={today}
                error={!!errors.startDate}
                required
              />
            </Field>
          </div>
        )}

        {type === 'entrada' && (
          <Field label="Mês de referência" error={errors.referenceMonth}>
            <Input
              name="referenceMonth"
              type="month"
              defaultValue={month}
              error={!!errors.referenceMonth}
              required
            />
          </Field>
        )}

        {type === 'investimento' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Aporte (R$)">
                <CurrencyInput name="amount" autoFocus />
              </Field>
              <Field label="Rendimento (R$)">
                <CurrencyInput name="yieldAmount" />
              </Field>
            </div>
            <Field label="Mês de referência" error={errors.referenceMonth}>
              <Input
                name="referenceMonth"
                type="month"
                defaultValue={month}
                error={!!errors.referenceMonth}
                required
              />
            </Field>
            <Field label="Observações">
              <Input name="notes" placeholder="Opcional" />
            </Field>
          </>
        )}

        {type === 'resgate' && (
          <>
            <Field label="Data do resgate" error={errors.date}>
              <Input name="date" type="date" defaultValue={today} error={!!errors.date} required />
            </Field>
            <Field label="Destino" error={errors.destination}>
              <Select name="destination" required>
                <SelectTrigger error={!!errors.destination}>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Caixa (lançar como entrada)</SelectItem>
                  <SelectItem value="transfer">Transferência entre investimentos</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Observações">
              <Input name="notes" placeholder="Opcional" />
            </Field>
          </>
        )}

        {/* Categoria + Conta */}
        {isExpense && (
          <>
            <Field label="Categoria" error={errors.categoryId}>
              <Select name="categoryId" required>
                <SelectTrigger error={!!errors.categoryId}>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categoryGroups.map((group) => (
                    <SelectGroup key={group.id}>
                      <SelectLabel>{group.name}</SelectLabel>
                      {group.categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Conta / Cartão" error={errors.accountId}>
              <Select name="accountId" required>
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
          </>
        )}

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" className="flex-1" loading={isPending}>
            Salvar
          </Button>
          {showFullPageLink && (
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/registro?month=${month}`} aria-label="Abrir formulário completo">
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
