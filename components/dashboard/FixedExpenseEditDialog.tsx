'use client'

import { useState, useTransition, useEffect, type FormEvent } from 'react'
import { Pencil } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
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
import { toast } from 'sonner'
import { updateFixedExpense } from '@/lib/actions/transactions'
import { getRegistrationFormData } from '@/lib/actions/form-data'
import { useMediaQuery } from '@/hooks/use-media-query'
import { fixedExpenseEditSchema } from '@/lib/validations/transactions'
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

type FixedExpense = {
  id: string
  name: string
  amount: string
  dueDay: number
  categoryId: string | null
  accountId: string | null
}

function EditForm({
  expense,
  categoryGroups,
  accounts,
  onSuccess,
}: {
  expense: FixedExpense
  categoryGroups: CategoryGroup[]
  accounts: Account[]
  onSuccess: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const str = (name: string) => (fd.get(name) as string) ?? ''

    const result = fixedExpenseEditSchema.safeParse({
      name: str('name'),
      amount: str('amount'),
      dueDay: str('dueDay'),
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
        await updateFixedExpense({
          id: expense.id,
          name: result.data.name,
          amount: result.data.amount,
          dueDay: Number(result.data.dueDay),
          categoryId: result.data.categoryId,
          accountId: result.data.accountId,
        })
        onSuccess()
      } catch {
        toast.error('Erro ao salvar. Tente novamente.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Nome" error={errors.name}>
        <Input name="name" defaultValue={expense.name} error={!!errors.name} required />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor" error={errors.amount}>
          <CurrencyInput
            name="amount"
            defaultValue={expense.amount}
            error={!!errors.amount}
            required
          />
        </Field>
        <Field label="Dia de vencimento" error={errors.dueDay}>
          <Input
            name="dueDay"
            type="number"
            min="1"
            max="31"
            defaultValue={expense.dueDay}
            error={!!errors.dueDay}
            required
          />
        </Field>
      </div>

      <Field label="Categoria" error={errors.categoryId}>
        <Select name="categoryId" defaultValue={expense.categoryId ?? undefined} required>
          <SelectTrigger>
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
        <Select name="accountId" defaultValue={expense.accountId ?? undefined} required>
          <SelectTrigger>
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

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Salvando...' : 'Salvar alterações'}
      </Button>
    </form>
  )
}

function FormLoader({ expense, onSuccess }: { expense: FixedExpense; onSuccess: () => void }) {
  const [formData, setFormData] = useState<{
    categoryGroups: CategoryGroup[]
    accounts: Account[]
  } | null>(null)

  useEffect(() => {
    getRegistrationFormData().then(setFormData)
  }, [])

  if (!formData) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        Carregando...
      </div>
    )
  }

  return (
    <EditForm
      expense={expense}
      categoryGroups={formData.categoryGroups}
      accounts={formData.accounts}
      onSuccess={onSuccess}
    />
  )
}

export function FixedExpenseEditButton({ expense }: { expense: FixedExpense }) {
  const [open, setOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const content = <FormLoader expense={expense} onSuccess={() => setOpen(false)} />

  if (isDesktop) {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(true)}
          aria-label="Editar"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar gasto fixo</DialogTitle>
            </DialogHeader>
            {content}
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        aria-label="Editar"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader>
            <DrawerTitle>Editar gasto fixo</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">{content}</div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
