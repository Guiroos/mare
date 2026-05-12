'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { toast } from 'sonner'
import { createInvestmentType, updateInvestmentType } from '@/lib/actions/investments'
import { investmentTypeSchema } from '@/lib/validations/investments'
import { formatZodErrors } from '@/lib/validations/utils'
import { useMediaQuery } from '@/hooks/use-media-query'

type Props = ({ mode: 'create' } | { mode: 'edit'; type: { id: string; name: string } }) & {
  open?: boolean
  onOpenChange?: (v: boolean) => void
}

export function InvestmentTypeDialog(props: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const isControlled = props.open !== undefined
  const open = isControlled ? props.open! : internalOpen

  const setOpen = (v: boolean) => {
    if (!v) setErrors({})
    if (isControlled) {
      props.onOpenChange?.(v)
    } else {
      setInternalOpen(v)
    }
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

  const title = props.mode === 'create' ? 'Novo tipo de investimento' : 'Editar tipo'

  const form = (
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
  )

  const trigger = !isControlled && (
    <Button size="sm" variant="outline" className="gap-1.5">
      <Plus className="h-4 w-4" />
      <span className="hidden sm:inline">Novo tipo</span>
    </Button>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {!isControlled && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <>
      {trigger}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">{form}</div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
