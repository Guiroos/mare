'use client'

import { useState, useTransition } from 'react'
import { DebtEntryDetail } from '@/lib/queries/debtors'
import { deleteDebtEntry } from '@/lib/actions/debtors'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useMediaQuery } from '@/hooks/use-media-query'
import { toast } from 'sonner'

type Props = {
  entry: DebtEntryDetail
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function PaymentWithIncomeDeleteDialog({ entry, open, onOpenChange }: Props) {
  const [alsoDeleteIncome, setAlsoDeleteIncome] = useState(true)
  const [isPending, startTransition] = useTransition()
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  function handleConfirm() {
    startTransition(async () => {
      try {
        await deleteDebtEntry({ id: entry.id, alsoDeleteIncome })
        toast.success('Pagamento excluído.')
        onOpenChange(false)
      } catch {
        toast.error('Erro ao excluir pagamento.')
        onOpenChange(false)
      }
    })
  }

  const toggle = (
    <Switch
      checked={alsoDeleteIncome}
      onChange={setAlsoDeleteIncome}
      label="Excluir também a entrada financeira vinculada"
    />
  )

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
              Este pagamento gerou uma entrada financeira. Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">{toggle}</div>
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
            Este pagamento gerou uma entrada financeira. Essa ação não pode ser desfeita.
          </p>
        </DrawerHeader>
        <div className="px-4 pb-6">
          <div className="mb-4">{toggle}</div>
          <div className="flex flex-col gap-2">
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
