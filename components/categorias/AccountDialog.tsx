'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
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
import { createPaymentAccount, updatePaymentAccount } from '@/lib/actions/categories'
import { accountSchema } from '@/lib/validations/categories'
import { formatZodErrors } from '@/lib/validations/utils'

type BaseProps = Record<never, never>
type CreateProps = BaseProps & { mode: 'create' }
type EditProps = BaseProps & {
  mode: 'edit'
  account: {
    id: string
    name: string
    type: string
    closingDay: number | null
  }
}

type Props = CreateProps | EditProps

const ACCOUNT_TYPES = [
  { value: 'credit', label: 'Crédito' },
  { value: 'debit', label: 'Débito' },
  { value: 'pix', label: 'Pix / Transferência' },
]

export function AccountDialog(props: Props) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState(props.mode === 'edit' ? props.account.type : 'credit')
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleOpenChange = (v: boolean) => {
    setOpen(v)
    if (!v) setErrors({})
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    const raw = {
      name: (fd.get('name') as string).trim(),
      type: fd.get('type') as string,
      closingDay: fd.get('closingDay') as string,
    }

    const result = accountSchema.safeParse(raw)
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      return
    }

    setErrors({})
    startTransition(async () => {
      try {
        const data = {
          name: result.data.name,
          type: result.data.type,
          closingDay: result.data.closingDay ? Number(result.data.closingDay) : undefined,
        }
        if (props.mode === 'create') {
          await createPaymentAccount(data)
        } else {
          await updatePaymentAccount(props.account.id, data)
        }
        setOpen(false)
      } catch {
        toast.error('Erro ao salvar.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {props.mode === 'create' ? (
          <Button size="sm" variant="outline" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Nova conta
          </Button>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-text-tertiary hover:text-text-primary"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === 'create' ? 'Nova conta / cartão' : 'Editar conta'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <Field label="Nome" required error={errors.name}>
            <Input
              name="name"
              defaultValue={props.mode === 'edit' ? props.account.name : ''}
              placeholder="Ex: NuBank, Débito, Pix..."
              error={!!errors.name}
              autoFocus
            />
          </Field>

          <Field label="Tipo" required>
            <Select
              name="type"
              defaultValue={props.mode === 'edit' ? props.account.type : 'credit'}
              onValueChange={setType}
              required
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {type === 'credit' && (
            <Field label="Dia de fechamento" hint="Opcional" error={errors.closingDay}>
              <Input
                name="closingDay"
                type="number"
                min="1"
                max="31"
                placeholder="Ex: 10"
                defaultValue={props.mode === 'edit' ? (props.account.closingDay ?? '') : ''}
                error={!!errors.closingDay}
              />
            </Field>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
