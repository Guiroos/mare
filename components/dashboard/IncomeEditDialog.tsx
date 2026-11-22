'use client'

import { useState, useEffect } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TransactionForm } from '@/components/forms/TransactionForm'
import type { TripOption } from '@/components/forms/transaction/TripPicker'
import { getTripOptions } from '@/lib/actions/trips'
import { ResponsiveDialog } from '@/components/ui/responsive-dialog'

type Income = {
  id: string
  source: string
  amount: string
  tripId: string | null
  canLinkTrip: boolean
}

export function IncomeEditButton({
  income,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  income: Income
  open?: boolean
  onOpenChange?: (v: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [trips, setTrips] = useState<TripOption[]>([])

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen! : internalOpen
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen

  useEffect(() => {
    if (open && income.canLinkTrip) getTripOptions().then(setTrips)
  }, [open, income.canLinkTrip])

  const content = (
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
      onSuccess={() => setOpen(false)}
    />
  )

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
        title="Editar entrada"
        className="max-w-sm"
      >
        {content}
      </ResponsiveDialog>
    </>
  )
}
