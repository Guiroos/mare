'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
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

type InvestmentType = {
  id: string
  name: string
}

type RegistrationDialogCtx = {
  open: (month?: string) => void
}

const ctx = createContext<RegistrationDialogCtx>({ open: () => {} })

export function useRegistrationDialog() {
  return useContext(ctx)
}

function FormContent({
  formData,
  month,
  onSuccess,
}: {
  formData: {
    categoryGroups: CategoryGroup[]
    accounts: Account[]
    investmentTypes: InvestmentType[]
  } | null
  month: string | undefined
  onSuccess: () => void
}) {
  if (!formData) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-text-secondary">
        Carregando...
      </div>
    )
  }
  return (
    <TransactionForm
      categoryGroups={formData.categoryGroups}
      accounts={formData.accounts}
      investmentTypes={formData.investmentTypes}
      defaultMonth={month}
      onSuccess={onSuccess}
    />
  )
}

export function RegistrationDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [month, setMonth] = useState<string | undefined>()
  const [formData, setFormData] = useState<{
    categoryGroups: CategoryGroup[]
    accounts: Account[]
    investmentTypes: InvestmentType[]
  } | null>(null)

  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const openDialog = useCallback((defaultMonth?: string) => {
    setMonth(defaultMonth)
    setIsOpen(true)
  }, [])

  useEffect(() => {
    if (isOpen && !formData) {
      getRegistrationFormData().then(setFormData)
    }
  }, [isOpen, formData])

  return (
    <ctx.Provider value={{ open: openDialog }}>
      {children}

      {isDesktop ? (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden p-0">
            <DialogHeader className="flex-shrink-0 px-6 pt-6">
              <DialogTitle>Novo lançamento</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <FormContent formData={formData} month={month} onSuccess={() => setIsOpen(false)} />
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={isOpen} onOpenChange={setIsOpen}>
          <DrawerContent className="max-h-[92dvh]">
            <DrawerHeader>
              <DrawerTitle>Novo lançamento</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-6">
              <FormContent formData={formData} month={month} onSuccess={() => setIsOpen(false)} />
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </ctx.Provider>
  )
}
