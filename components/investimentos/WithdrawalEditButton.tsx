'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { Pencil } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { updateWithdrawal } from '@/lib/actions/investments'
import { withdrawalEditSchema } from '@/lib/validations/investments'
import { formatZodErrors } from '@/lib/validations/utils'

type Withdrawal = {
  id: string
  investmentTypeId: string
  amount: number | string
  date: string
  notes: string | null
}

type Props = {
  withdrawal: Withdrawal
  investmentTypes: { id: string; name: string }[]
}

export function WithdrawalEditButton({ withdrawal, investmentTypes }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [typeId, setTypeId] = useState(withdrawal.investmentTypeId)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleOpenChange = (v: boolean) => {
    setOpen(v)
    if (!v) setErrors({})
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const str = (name: string) => (fd.get(name) as string) ?? ''

    const result = withdrawalEditSchema.safeParse({
      investmentTypeId: typeId,
      amount: str('amount'),
      date: str('date'),
    })

    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      return
    }

    setErrors({})
    startTransition(async () => {
      try {
        await updateWithdrawal({
          id: withdrawal.id,
          investmentTypeId: result.data.investmentTypeId,
          amount: result.data.amount,
          date: result.data.date,
          notes: str('notes') || null,
        })
        setOpen(false)
      } catch {
        toast.error('Erro ao salvar. Tente novamente.')
      }
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        aria-label="Editar resgate"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar resgate</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
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
              <CurrencyInput
                name="amount"
                defaultValue={withdrawal.amount}
                error={!!errors.amount}
                required
              />
            </Field>

            <Field label="Data do resgate" error={errors.date}>
              <Input
                name="date"
                type="date"
                defaultValue={withdrawal.date}
                error={!!errors.date}
                required
              />
            </Field>

            <Field label="Observações">
              <Input name="notes" defaultValue={withdrawal.notes ?? ''} placeholder="Opcional" />
            </Field>

            <p className="text-xs text-muted-foreground">
              O destino do resgate não pode ser alterado.
            </p>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
