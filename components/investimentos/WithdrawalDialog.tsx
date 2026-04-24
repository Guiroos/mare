'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { createWithdrawal } from '@/lib/actions/investments'
import { withdrawalSchema } from '@/lib/validations/investments'
import { formatZodErrors } from '@/lib/validations/utils'

type Props = {
  investmentTypes: { id: string; name: string }[]
}

export function WithdrawalDialog({ investmentTypes }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [destination, setDestination] = useState<'income' | 'transfer'>('income')
  const [typeId, setTypeId] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleOpenChange = (v: boolean) => {
    setOpen(v)
    if (!v) setErrors({})
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    const result = withdrawalSchema.safeParse({
      investmentTypeId: typeId,
      amount: (fd.get('amount') as string).trim(),
      date: (fd.get('date') as string).trim(),
      destination,
    })

    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      return
    }

    setErrors({})
    startTransition(async () => {
      try {
        await createWithdrawal({
          investmentTypeId: result.data.investmentTypeId,
          amount: result.data.amount,
          date: result.data.date,
          destination: result.data.destination,
          notes: (fd.get('notes') as string).trim() || null,
        })
        setOpen(false)
        setTypeId('')
        setDestination('income')
      } catch {
        toast.error('Erro ao registrar resgate.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Registrar resgate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar resgate</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <Field label="Tipo de investimento" error={errors.investmentTypeId}>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {investmentTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Valor (R$)" error={errors.amount}>
            <CurrencyInput name="amount" error={!!errors.amount} required />
          </Field>
          <Field label="Data do resgate" error={errors.date}>
            <Input name="date" type="date" error={!!errors.date} required />
          </Field>
          <Field label="Destino">
            <Select
              value={destination}
              onValueChange={(v) => setDestination(v as 'income' | 'transfer')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Caixa (lançar como entrada)</SelectItem>
                <SelectItem value="transfer">Transferência entre investimentos</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Observações" hint="Opcional">
            <Input name="notes" />
          </Field>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Salvando...' : 'Registrar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
