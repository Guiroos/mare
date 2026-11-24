'use client'

import { useState, useEffect } from 'react'
import { TransactionForm } from '@/components/forms/TransactionForm'
import type { TripOption } from '@/components/forms/transaction/TripPicker'
import { getTripOptions } from '@/lib/actions/trips'
import { EditDialogShell } from '@/components/dashboard/EditDialogShell'

type Income = {
  id: string
  source: string
  amount: string
  tripId: string | null
  canLinkTrip: boolean
}

// Montado só com o diálogo aberto: o fetch de viagens roda a cada abertura.
function IncomeForm({ income, onSuccess }: { income: Income; onSuccess: () => void }) {
  const [trips, setTrips] = useState<TripOption[]>([])

  useEffect(() => {
    if (income.canLinkTrip) getTripOptions().then(setTrips)
  }, [income.canLinkTrip])

  return (
    <TransactionForm
      mode="edit"
      categoryGroups={[]}
      accounts={[]}
      trips={trips}
      editContext={{
        entityId: income.id,
        primaryType: 'entrada',
        canLinkTrip: income.canLinkTrip,
        initialValues: { source: income.source, amount: income.amount, tripId: income.tripId },
      }}
      onSuccess={onSuccess}
    />
  )
}

export function IncomeEditButton({
  income,
  open,
  onOpenChange,
}: {
  income: Income
  open?: boolean
  onOpenChange?: (v: boolean) => void
}) {
  return (
    <EditDialogShell
      title="Editar entrada"
      className="max-w-sm"
      scrollableDrawer={false}
      open={open}
      onOpenChange={onOpenChange}
    >
      {(close) => <IncomeForm income={income} onSuccess={close} />}
    </EditDialogShell>
  )
}
