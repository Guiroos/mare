'use client'

import { useState, useTransition } from 'react'
import { DebtEntryDetail } from '@/lib/queries/debtors'
import { deleteDebtEntry } from '@/lib/actions/debtors'
import { formatCurrency } from '@/lib/utils/currency'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useMediaQuery } from '@/hooks/use-media-query'
import { toast } from 'sonner'

type Props = {
  entry: DebtEntryDetail
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function PaymentWithSettledChargesDeleteDialog({ entry, open, onOpenChange }: Props) {
  const [alsoDeleteIncome, setAlsoDeleteIncome] = useState(true)
  const [isPending, startTransition] = useTransition()
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const chargeCount = entry.settledCharges.length
  const chargeLabel = chargeCount === 1 ? '1 cobrança' : `${chargeCount} cobranças`

  function handleConfirm() {
    startTransition(async () => {
      try {
        await deleteDebtEntry({
          id: entry.id,
          alsoDeleteIncome: entry.incomeId ? alsoDeleteIncome : false,
        })
        toast.success('Pagamento excluído. Cobranças reabertas.')
        onOpenChange(false)
      } catch {
        toast.error('Erro ao excluir pagamento.')
      }
    })
  }

  const chargeList = (
    <ul className="mt-2 space-y-1">
      {entry.settledCharges.map((c) => (
        <li
          key={c.id}
          className="flex items-center justify-between gap-2 text-caption text-text-secondary"
        >
          <span className="truncate">• {c.description}</span>
          <span className="shrink-0 tabular-nums">{formatCurrency(c.amount)}</span>
        </li>
      ))}
    </ul>
  )

  const incomeToggle = entry.incomeId ? (
    <div className="pt-2">
      <Switch
        checked={alsoDeleteIncome}
        onChange={setAlsoDeleteIncome}
        label="Excluir também a entrada financeira vinculada"
      />
    </div>
  ) : null

  const actions = (
    <>
      <Button variant="ghost" disabled={isPending} onClick={() => onOpenChange(false)}>
        Cancelar
      </Button>
      <Button variant="danger" disabled={isPending} onClick={handleConfirm}>
        {isPending ? '...' : 'Excluir'}
      </Button>
    </>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir pagamento</DialogTitle>
            <DialogDescription>
              Este pagamento quitou {chargeLabel}. Excluí-lo vai reabrir{' '}
              {chargeCount === 1 ? 'essa cobrança' : 'essas cobranças'}.
            </DialogDescription>
          </DialogHeader>
          {chargeList}
          {incomeToggle}
          <DialogFooter>{actions}</DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Excluir pagamento</DrawerTitle>
          <p className="text-body text-text-secondary">
            Este pagamento quitou {chargeLabel}. Excluí-lo vai reabrir{' '}
            {chargeCount === 1 ? 'essa cobrança' : 'essas cobranças'}.
          </p>
        </DrawerHeader>
        <div className="px-4 pb-6">
          {chargeList}
          {incomeToggle && <div className="mt-4">{incomeToggle}</div>}
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="danger" disabled={isPending} onClick={handleConfirm}>
              {isPending ? '...' : 'Excluir'}
            </Button>
            <Button variant="ghost" disabled={isPending} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
