'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { Pencil } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { toast } from 'sonner'
import { updateIncome } from '@/lib/actions/incomes'
import { useMediaQuery } from '@/hooks/use-media-query'
import { incomeEditSchema } from '@/lib/validations/transactions'
import { formatZodErrors } from '@/lib/validations/utils'

type Income = {
  id: string
  source: string
  amount: string
}

function EditForm({ income, onSuccess }: { income: Income; onSuccess: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const source = (fd.get('source') as string) ?? ''
    const amount = (fd.get('amount') as string) ?? ''

    const result = incomeEditSchema.safeParse({ source, amount })
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      return
    }

    setErrors({})
    startTransition(async () => {
      try {
        await updateIncome({
          id: income.id,
          source: result.data.source,
          amount: result.data.amount,
        })
        onSuccess()
      } catch {
        toast.error('Erro ao salvar. Tente novamente.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Origem" error={errors.source}>
        <Input name="source" defaultValue={income.source} error={!!errors.source} required />
      </Field>

      <Field label="Valor" error={errors.amount}>
        <CurrencyInput
          name="amount"
          defaultValue={income.amount}
          error={!!errors.amount}
          required
        />
      </Field>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Salvando...' : 'Salvar alterações'}
      </Button>
    </form>
  )
}

export function IncomeEditButton({ income }: { income: Income }) {
  const [open, setOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const content = <EditForm income={income} onSuccess={() => setOpen(false)} />

  if (isDesktop) {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-text-secondary hover:text-text-primary"
          onClick={() => setOpen(true)}
          aria-label="Editar"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
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
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-text-secondary hover:text-text-primary"
        onClick={() => setOpen(true)}
        aria-label="Editar"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
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
