'use client'

import { TransactionForm } from '@/components/forms/TransactionForm'
import { EditDialogShell, EditFormLoader } from '@/components/dashboard/EditDialogShell'

type Transaction = {
  id: string
  name: string
  amount: string
  date: string
  categoryId: string | null
  accountId: string | null
  tripId: string | null
}

export function TransactionEditButton({
  transaction,
  open,
  onOpenChange,
}: {
  transaction: Transaction
  open?: boolean
  onOpenChange?: (v: boolean) => void
}) {
  return (
    <EditDialogShell
      title="Editar transação"
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
              trips={formData.trips}
              categoryVariant="combobox"
              editContext={{
                entityId: transaction.id,
                primaryType: 'saida',
                subType: 'avulsa',
                initialValues: {
                  name: transaction.name,
                  amount: transaction.amount,
                  date: transaction.date,
                  categoryId: transaction.categoryId ?? undefined,
                  accountId: transaction.accountId ?? undefined,
                  tripId: transaction.tripId,
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
