'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { toast } from 'sonner'
import { createFaturaPayment } from '@/lib/actions/fatura'
import { useMediaQuery } from '@/hooks/use-media-query'
import { formatCurrency } from '@/lib/utils/currency'
import { todayISOString } from '@/lib/utils/date'

type DebitAccount = { id: string; name: string; type: string }

type PayableCycle = {
  cycleMonth: string
  cycleEnd: string
  total: number
}

type Props = {
  accountId: string
  accountName: string
  cycle: PayableCycle
  debitAccounts: DebitAccount[]
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function FaturaPaymentDialog({
  accountId,
  accountName,
  cycle,
  debitAccounts,
  open,
  onOpenChange,
}: Props) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [isPending, startTransition] = useTransition()
  const [sourceAccountId, setSourceAccountId] = useState('')
  const [date, setDate] = useState(todayISOString)
  const [accountError, setAccountError] = useState('')
  const [dateError, setDateError] = useState('')

  const minDate = cycle.cycleEnd

  const handleOpenChange = (v: boolean) => {
    onOpenChange(v)
    if (!v) {
      setSourceAccountId('')
      setDate(todayISOString())
      setAccountError('')
      setDateError('')
    }
  }

  const handleSubmit = () => {
    let valid = true
    if (!sourceAccountId) {
      setAccountError('Selecione a conta de débito')
      valid = false
    } else {
      setAccountError('')
    }
    if (!date || date <= minDate) {
      setDateError(`Data deve ser posterior a ${minDate}`)
      valid = false
    } else {
      setDateError('')
    }
    if (!valid) return

    startTransition(async () => {
      try {
        await createFaturaPayment({
          faturaAccountId: accountId,
          faturaCycleMonth: cycle.cycleMonth,
          sourceAccountId,
          amount: cycle.total.toString(),
          date,
        })
        handleOpenChange(false)
        toast.success('Pagamento registrado')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao registrar pagamento')
      }
    })
  }

  const form = (
    <div className="flex flex-col gap-4">
      <Field label="Fatura">
        <Input value={accountName} disabled />
      </Field>

      <Field label="Total da fatura">
        <Input value={formatCurrency(cycle.total)} disabled />
      </Field>

      <Field label="Pagar com" error={accountError}>
        <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
          <SelectTrigger className="bg-bg-input">
            <SelectValue placeholder="Selecione a conta..." />
          </SelectTrigger>
          <SelectContent>
            {debitAccounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Data do pagamento" error={dateError}>
        <Input type="date" value={date} min={minDate} onChange={(e) => setDate(e.target.value)} />
      </Field>

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={handleSubmit}
        disabled={isPending}
      >
        {isPending ? 'Registrando...' : 'Confirmar pagamento'}
      </Button>
    </div>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pagamento de fatura</DialogTitle>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Registrar pagamento de fatura</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6">{form}</div>
      </DrawerContent>
    </Drawer>
  )
}
