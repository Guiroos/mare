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
import { createCategoryGroup, updateCategoryGroup } from '@/lib/actions/categories'
import { groupSchema } from '@/lib/validations/categories'
import { formatZodErrors } from '@/lib/validations/utils'

type Props = { mode: 'create' } | { mode: 'edit'; group: { id: string; name: string } }

export function GroupDialog(props: Props) {
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

    const result = groupSchema.safeParse({ name })
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      return
    }

    setErrors({})
    startTransition(async () => {
      try {
        if (props.mode === 'create') {
          await createCategoryGroup(result.data.name)
        } else {
          await updateCategoryGroup(props.group.id, result.data.name)
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
            Novo grupo
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
          <DialogTitle>{props.mode === 'create' ? 'Novo grupo' : 'Editar grupo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <Field label="Nome do grupo" required error={errors.name}>
            <Input
              name="name"
              defaultValue={props.mode === 'edit' ? props.group.name : ''}
              placeholder="Ex: Essencial, Estilo de Vida..."
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
