'use client'

import { useState, useEffect } from 'react'
import { Pencil } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { TransactionForm } from '@/components/forms/TransactionForm'
import { getRegistrationFormData } from '@/lib/actions/form-data'
import { useMediaQuery } from '@/hooks/use-media-query'

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
        entityId: transaction.id,
        primaryType: 'saida',
        subType: 'avulsa',
        initialValues: {
          name: transaction.name,
          amount: transaction.amount,
          date: transaction.date,
          categoryId: transaction.categoryId ?? undefined,
          accountId: transaction.accountId ?? undefined,
        },
      }}
      onSuccess={onSuccess}
    />
  )
}

export function TransactionEditButton({
  transaction,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  transaction: Transaction
  open?: boolean
  onOpenChange?: (v: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen! : internalOpen
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen

  const content = <FormLoader transaction={transaction} onSuccess={() => setOpen(false)} />

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
