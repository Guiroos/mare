'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { Button, type ButtonSize } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
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
import { DEFAULT_INVESTMENT_TYPE_COLOR } from '@/lib/utils/color'
import { useMediaQuery } from '@/hooks/use-media-query'

type Props =
  | { mode: 'create' }
  | { mode: 'edit'; type: { id: string; name: string; color: string | null } }

type DialogProps = Props & {
  open?: boolean
  onOpenChange?: (v: boolean) => void
  triggerSize?: ButtonSize
}

export function InvestmentTypeDialog(props: DialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const defaultAutomaticColor =
    props.mode === 'create' ||
    props.type.color === null ||
    props.type.color === DEFAULT_INVESTMENT_TYPE_COLOR
  const [useAutomaticColor, setUseAutomaticColor] = useState(defaultAutomaticColor)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const isControlled = props.open !== undefined
  const open = isControlled ? props.open! : internalOpen

  const setOpen = (v: boolean) => {
    if (!v) {
      setErrors({})
      setUseAutomaticColor(defaultAutomaticColor)
    }
    if (isControlled) {
      props.onOpenChange?.(v)
    } else {
      setInternalOpen(v)
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const raw = {
      name: (fd.get('name') as string).trim(),
      color: useAutomaticColor ? undefined : (fd.get('color') as string) || undefined,
    }

    const result = investmentTypeSchema.safeParse(raw)
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      return
    }

    setErrors({})
    startTransition(async () => {
      try {
        if (props.mode === 'create') {
          await createInvestmentType(result.data)
        } else {
          await updateInvestmentType(props.type.id, result.data)
        }
        setOpen(false)
      } catch {
        toast.error('Erro ao salvar.')
      }
    })
  }

  const title = props.mode === 'create' ? 'Novo tipo de investimento' : 'Editar tipo'
  const triggerSize = props.triggerSize ?? 'sm'

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
      <Field label="Cor" hint="A cor automática usa o azul principal da Maré." error={errors.color}>
        <div className="space-y-3">
          <Switch
            label="Cor automática"
            checked={useAutomaticColor}
            onChange={setUseAutomaticColor}
          />
          {!useAutomaticColor && (
            <div className="flex items-center gap-3">
              <input
                type="color"
                name="color"
                defaultValue={
                  props.mode === 'edit'
                    ? (props.type.color ?? DEFAULT_INVESTMENT_TYPE_COLOR)
                    : DEFAULT_INVESTMENT_TYPE_COLOR
                }
                className="h-12 w-14 cursor-pointer rounded-md border border-border bg-bg-surface p-1 outline-none transition duration-fast focus:border-accent focus:shadow-[0_0_0_3px_var(--ring-accent)]"
              />
            </div>
          )}
        </div>
      </Field>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Salvando...' : 'Salvar'}
      </Button>
    </form>
  )

  const trigger = !isControlled && (
    <Button
      size={triggerSize}
      variant="outline"
      className={triggerSize === 'md' ? 'gap-2' : 'gap-1.5'}
    >
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
