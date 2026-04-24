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
import { toast } from 'sonner'
import { createInvestmentType, updateInvestmentType } from '@/lib/actions/investments'
import { investmentTypeSchema } from '@/lib/validations/investments'
import { formatZodErrors } from '@/lib/validations/utils'

type Props = { mode: 'create' } | { mode: 'edit'; type: { id: string; name: string } }

export function InvestmentTypeDialog(props: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleOpenChange = (v: boolean) => {
    setOpen(v)
    if (!v) setErrors({})
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const name = (new FormData(e.currentTarget).get('name') as string).trim()

    const result = investmentTypeSchema.safeParse({ name })
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      return
    }

    setErrors({})
    startTransition(async () => {
      try {
        if (props.mode === 'create') {
          await createInvestmentType(result.data.name)
        } else {
          await updateInvestmentType(props.type.id, result.data.name)
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
            Novo tipo
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
            {props.mode === 'create' ? 'Novo tipo de investimento' : 'Editar tipo'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <Field label="Nome" error={errors.name}>
            <Input
              name="name"
              defaultValue={props.mode === 'edit' ? props.type.name : ''}
              placeholder="Ex: Reserva de emergência, Renda fixa..."
              error={!!errors.name}
              autoFocus
            />
          </Field>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
