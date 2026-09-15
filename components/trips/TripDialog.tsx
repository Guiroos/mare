'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { Button, ButtonSize, ButtonVariant } from '@/components/ui/button'
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
import { upsertTrip } from '@/lib/actions/trips'
import { tripSchema } from '@/lib/validations/trips'
import { formatZodErrors } from '@/lib/validations/utils'
import { useMediaQuery } from '@/hooks/use-media-query'

type GoalOption = { id: string; name: string }

type Props =
  | {
      mode: 'create'
      goals: GoalOption[]
      triggerSize?: ButtonSize
      triggerVariant?: ButtonVariant
    }
  | {
      mode: 'edit'
      goals: GoalOption[]
      trip: {
        id: string
        name: string
        startDate: string | null
        endDate: string | null
        goalId: string | null
      }
    }

export function TripDialog(props: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const initialGoalId = props.mode === 'edit' ? (props.trip.goalId ?? 'none') : 'none'
  const [goalId, setGoalId] = useState(initialGoalId)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  // Nome e datas são defaultValue e resetam ao remontar; goalId é state e precisa de reset explícito
  const openDialog = () => {
    setGoalId(initialGoalId)
    setErrors({})
    setOpen(true)
  }

  const handleOpenChange = (v: boolean) => {
    setOpen(v)
    if (!v) setErrors({})
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const name = (fd.get('name') as string).trim()
    const startDate = (fd.get('startDate') as string).trim() || null
    const endDate = (fd.get('endDate') as string).trim() || null

    const result = tripSchema.safeParse({ name, startDate, endDate })
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      return
    }

    setErrors({})
    startTransition(async () => {
      try {
        await upsertTrip({
          name: result.data.name,
          startDate,
          endDate,
          goalId: goalId === 'none' ? null : goalId || null,
          existingId: props.mode === 'edit' ? props.trip.id : undefined,
        })
        setOpen(false)
      } catch {
        toast.error('Erro ao salvar.')
      }
    })
  }

  const title = props.mode === 'create' ? 'Nova viagem' : 'Editar viagem'

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Nome" required error={errors.name}>
        <Input
          name="name"
          defaultValue={props.mode === 'edit' ? props.trip.name : ''}
          placeholder="Ex: Rock in Rio 2026, Europa..."
          error={!!errors.name}
          autoFocus
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Início" hint="Opcional">
          <Input
            name="startDate"
            type="date"
            defaultValue={props.mode === 'edit' ? (props.trip.startDate ?? '') : ''}
          />
        </Field>
        <Field label="Fim" hint="Opcional">
          <Input
            name="endDate"
            type="date"
            defaultValue={props.mode === 'edit' ? (props.trip.endDate ?? '') : ''}
          />
        </Field>
      </div>
      {props.goals.length > 0 && (
        <Field
          label="Caixinha de investimento"
          hint="Opcional. Vincule uma meta para acompanhar o quanto já foi guardado para essa viagem."
        >
          <Select value={goalId} onValueChange={setGoalId}>
            <SelectTrigger>
              <SelectValue placeholder="Sem vínculo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem vínculo</SelectItem>
              {props.goals.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Salvando...' : 'Salvar'}
      </Button>
    </form>
  )

  return (
    <>
      {props.mode === 'create' ? (
        <Button
          size={props.triggerSize ?? 'sm'}
          variant={props.triggerVariant ?? 'outline'}
          className={(props.triggerSize ?? 'sm') === 'md' ? 'gap-2' : 'gap-1.5'}
          onClick={openDialog}
        >
          <Plus className="h-4 w-4" />
          Nova viagem
        </Button>
      ) : (
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-text-tertiary hover:text-text-primary"
          onClick={openDialog}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}

      {isDesktop ? (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            {form}
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={open} onOpenChange={handleOpenChange}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{title}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-6">{form}</div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  )
}
