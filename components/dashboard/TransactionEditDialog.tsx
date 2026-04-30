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
import { updateTransaction } from '@/lib/actions/transactions'
import { getRegistrationFormData } from '@/lib/actions/form-data'
import { useMediaQuery } from '@/hooks/use-media-query'
import { transactionSchema } from '@/lib/validations/transactions'
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

type Transaction = {
  id: string
  name: string
  amount: string
  date: string
  categoryId: string | null
  accountId: string | null
}

function EditForm({
  transaction,
  categoryGroups,
  accounts,
  onSuccess,
}: {
  transaction: Transaction
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
        await updateTransaction({ id: transaction.id, ...result.data })
        onSuccess()
      } catch {
        toast.error('Erro ao salvar. Tente novamente.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Nome" error={errors.name}>
        <Input name="name" defaultValue={transaction.name} error={!!errors.name} required />
      </Field>

      <Field label="Valor" error={errors.amount}>
        <CurrencyInput
          name="amount"
          defaultValue={transaction.amount}
          error={!!errors.amount}
          required
        />
      </Field>

      <Field label="Data" error={errors.date}>
        <Input
          name="date"
          type="date"
          defaultValue={transaction.date}
          error={!!errors.date}
          required
        />
      </Field>

      <Field label="Categoria" error={errors.categoryId}>
        <Select name="categoryId" defaultValue={transaction.categoryId ?? undefined} required>
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
        <Select name="accountId" defaultValue={transaction.accountId ?? undefined} required>
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

function FormLoader({
  transaction,
  onSuccess,
}: {
  transaction: Transaction
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState<{
    categoryGroups: CategoryGroup[]
    accounts: Account[]
  } | null>(null)

  useEffect(() => {
    getRegistrationFormData().then(setFormData)
  }, [])

  if (!formData) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-text-secondary">
        Carregando...
      </div>
    )
  }

  return (
    <EditForm
      transaction={transaction}
      categoryGroups={formData.categoryGroups}
      accounts={formData.accounts}
      onSuccess={onSuccess}
    />
  )
}

export function TransactionEditButton({ transaction }: { transaction: Transaction }) {
  const [open, setOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const content = <FormLoader transaction={transaction} onSuccess={() => setOpen(false)} />

  if (isDesktop) {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-text-secondary hover:text-text-primary"
          onClick={() => setOpen(true)}
          aria-label="Editar"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar transação</DialogTitle>
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
        className="h-7 w-7 shrink-0 text-text-secondary hover:text-text-primary"
        onClick={() => setOpen(true)}
        aria-label="Editar"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader>
            <DrawerTitle>Editar transação</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">{content}</div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
