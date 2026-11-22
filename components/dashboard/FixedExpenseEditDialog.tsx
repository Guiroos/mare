'use client'

import { TransactionForm } from '@/components/forms/TransactionForm'
import { EditDialogShell } from '@/components/dashboard/EditDialogShell'
import { EditFormLoader } from '@/components/dashboard/EditFormLoader'

type FixedExpense = {
  id: string
  name: string
  amount: string
  dueDay: number
  categoryId: string | null
  accountId: string | null
}

export function FixedExpenseEditButton({
  expense,
  open,
  onOpenChange,
}: {
  expense: FixedExpense
  open?: boolean
  onOpenChange?: (v: boolean) => void
}) {
  return (
    <EditDialogShell
      title="Editar gasto fixo"
      className="max-w-md"
      open={open}
      onOpenChange={onOpenChange}
    >
      {(close) => (
        <EditFormLoader>
          {(formData) => (
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
              onSuccess={close}
            />
          )}
        </EditFormLoader>
      )}
    </EditDialogShell>
  )
}
