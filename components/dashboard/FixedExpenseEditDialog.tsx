'use client'

import { useState, useEffect } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TransactionForm } from '@/components/forms/TransactionForm'
import { getRegistrationFormData } from '@/lib/actions/form-data'
import { ResponsiveDialog } from '@/components/ui/responsive-dialog'

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
      <div className="flex items-center justify-center py-10 text-small text-text-secondary">
        Carregando...
      </div>
    )
  }

  return (
    <TransactionForm
      mode="edit"
      categoryGroups={formData.categoryGroups}
      accounts={formData.accounts}
      categoryVariant="combobox"
      editContext={{
        entityId: expense.id,
        primaryType: 'saida',
        subType: 'fixa',
        initialValues: {
          name: expense.name,
          amount: expense.amount,
          dueDay: expense.dueDay,
          categoryId: expense.categoryId ?? undefined,
          accountId: expense.accountId ?? undefined,
        },
      }}
      onSuccess={onSuccess}
    />
  )
}

export function FixedExpenseEditButton({
  expense,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  expense: FixedExpense
  open?: boolean
  onOpenChange?: (v: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = useState(false)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen! : internalOpen
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen

  const content = <FormLoader expense={expense} onSuccess={() => setOpen(false)} />

  return (
    <>
      {!isControlled && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-text-secondary hover:text-text-primary"
          onClick={() => setOpen(true)}
          aria-label="Editar"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Editar gasto fixo"
        className="max-w-md"
        drawerClassName="max-h-[92dvh]"
        drawerBodyClassName="overflow-y-auto px-4 pb-6"
      >
        {content}
      </ResponsiveDialog>
    </>
  )
}
