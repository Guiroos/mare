'use client'

import { useEffect, useState, useTransition, SyntheticEvent } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TripPicker, type TripOption } from '@/components/forms/transaction/TripPicker'
import { toast } from 'sonner'
import { createWithdrawal } from '@/lib/actions/investments'
import { getTripOptions } from '@/lib/actions/trips'
import { withdrawalSchema } from '@/lib/validations/investments'
import { formatZodErrors } from '@/lib/validations/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { useMediaQuery } from '@/hooks/use-media-query'

type Props = {
  investmentTypes: { id: string; name: string }[]
  initialTypeId?: string
  initialAmount?: number
  initialDestination?: 'income' | 'reinvest'
  open?: boolean
  onOpenChange?: (v: boolean) => void
}

export function WithdrawalDialog({
  investmentTypes,
  initialTypeId,
  initialAmount,
  initialDestination,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [destination, setDestination] = useState<'income' | 'reinvest'>(
    initialDestination ?? 'income'
  )
  const [typeId, setTypeId] = useState(initialTypeId ?? '')
  const [tripId, setTripId] = useState('')
  const [trips, setTrips] = useState<TripOption[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [hasTax, setHasTax] = useState(false)
  const [grossCents, setGrossCents] = useState(() =>
    initialAmount ? Math.round(initialAmount * 100) : 0
  )
  const [taxCents, setTaxCents] = useState(0)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen! : internalOpen

  const netCents = grossCents - taxCents
  const netAmount = netCents / 100

  // Dialog é aberto de /investimentos e do alerta de vencimento no dashboard — carregar
  // as viagens na abertura evita propagar a lista pelas duas árvores
  useEffect(() => {
    if (open) getTripOptions().then(setTrips)
  }, [open])

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setErrors({})
      setHasTax(false)
      setGrossCents(0)
      setTaxCents(0)
      if (!initialTypeId) setTypeId('')
      setTripId('')
      setDestination('income')
    }
    if (isControlled) {
      controlledOnOpenChange?.(v)
    } else {
      setInternalOpen(v)
    }
  }

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    const result = withdrawalSchema.safeParse({
      investmentTypeId: typeId,
      amount: (fd.get('amount') as string).trim(),
      date: (fd.get('date') as string).trim(),
      destination,
      taxAmount: hasTax ? (fd.get('taxAmount') as string) || null : null,
      tripId: destination === 'income' ? tripId : undefined,
    })

    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      return
    }

    setErrors({})
    startTransition(async () => {
      try {
        const typeName =
          investmentTypes.find((t) => t.id === result.data.investmentTypeId)?.name ?? ''
        await createWithdrawal({
          investmentTypeId: result.data.investmentTypeId,
          investmentTypeName: typeName,
          amount: result.data.amount,
          date: result.data.date,
          destination: result.data.destination,
          taxAmount: result.data.taxAmount ?? null,
          notes: (fd.get('notes') as string).trim() || null,
          tripId: result.data.tripId,
        })
        handleOpenChange(false)
      } catch {
        toast.error('Erro ao registrar resgate.')
      }
    })
  }

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      <Field label="Houve desconto de imposto?">
        <Switch label="Sim, houve IR ou IOF" checked={hasTax} onChange={setHasTax} />
      </Field>

      {hasTax ? (
        <>
          <Field label="Valor bruto (R$)" error={errors.amount}>
            <CurrencyInput
              name="_gross"
              onValueChange={setGrossCents}
              error={!!errors.amount}
              required
            />
          </Field>
          <Field label="Imposto (IR/IOF) (R$)">
            <CurrencyInput name="_tax" onValueChange={setTaxCents} />
          </Field>
          <p className="text-caption text-text-secondary">
            Valor líquido:{' '}
            <strong className="font-semibold tabular-nums text-text-primary">
              {formatCurrency(netAmount > 0 ? netAmount : 0)}
            </strong>
          </p>
          <input
            type="hidden"
            name="amount"
            value={netCents > 0 ? (netCents / 100).toFixed(2) : ''}
          />
          <input type="hidden" name="taxAmount" value={(taxCents / 100).toFixed(2)} />
        </>
      ) : (
        <Field label="Valor recebido (R$)" error={errors.amount}>
          <CurrencyInput
            name="amount"
            defaultValue={initialAmount}
            error={!!errors.amount}
            required
          />
        </Field>
      )}

      <Field label="Data do resgate" error={errors.date}>
        <Input name="date" type="date" error={!!errors.date} required />
      </Field>

      <Field label="Destino">
        <Select
          value={destination}
          onValueChange={(v) => setDestination(v as 'income' | 'reinvest')}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="income">Caixa (uso pessoal / emergência)</SelectItem>
            <SelectItem value="reinvest">Reinvestimento (mostrar só rendimento)</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {destination === 'income' && (
        <TripPicker trips={trips} tripId={tripId} onTripChange={setTripId} error={errors.tripId} />
      )}

      {destination === 'reinvest' && (
        <p className="text-caption text-text-secondary">
          Ao criar o novo aporte, marque{' '}
          <strong className="font-medium text-text-primary">&quot;Já tinha o valor&quot;</strong>{' '}
          para que o capital não seja contabilizado como saída do caixa novamente.
        </p>
      )}

      <Field label="Observações" hint="Opcional">
        <Input name="notes" />
      </Field>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Salvando...' : 'Registrar'}
      </Button>
    </form>
  )

  return (
    <>
      {!isControlled && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setInternalOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Registrar resgate</span>
        </Button>
      )}

      {isDesktop ? (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar resgate</DialogTitle>
            </DialogHeader>
            {form}
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={open} onOpenChange={handleOpenChange}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Registrar resgate</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-6">{form}</div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  )
}
