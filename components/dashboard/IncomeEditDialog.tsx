'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { TransactionForm } from '@/components/forms/TransactionForm'
import { useMediaQuery } from '@/hooks/use-media-query'

type Income = {
  id: string
  source: string
  amount: string
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
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen! : internalOpen
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen

  const content = (
    <TransactionForm
      mode="edit"
      categoryGroups={[]}
      accounts={[]}
      editContext={{
        entityId: income.id,
        primaryType: 'entrada',
        initialValues: { source: income.source, amount: income.amount },
      }}
      onSuccess={() => setOpen(false)}
    />
  )

  if (isDesktop) {
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Editar entrada</DialogTitle>
            </DialogHeader>
            {content}
          </DialogContent>
        </Dialog>
      </>
    )
  }

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
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Editar entrada</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">{content}</div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
