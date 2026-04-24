'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CurrencyInput } from '@/components/ui/currency-input'
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
import { createCategory, updateCategory } from '@/lib/actions/categories'
import { categorySchema } from '@/lib/validations/categories'
import { formatZodErrors } from '@/lib/validations/utils'

type Group = { id: string; name: string }

type BaseProps = { groups: Group[] }
type CreateProps = BaseProps & { mode: 'create'; defaultGroupId: string }
type EditProps = BaseProps & {
  mode: 'edit'
  category: {
    id: string
    name: string
    groupId: string
    defaultBudget: string | null
    color: string | null
  }
}

type Props = CreateProps | EditProps

export function CategoryDialog(props: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const defaultGroupId = props.mode === 'create' ? props.defaultGroupId : props.category.groupId

  const handleOpenChange = (v: boolean) => {
    setOpen(v)
    if (!v) setErrors({})
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    const raw = {
      name: (fd.get('name') as string).trim(),
      groupId: fd.get('groupId') as string,
      defaultBudget: (fd.get('defaultBudget') as string) || undefined,
      color: (fd.get('color') as string) || undefined,
    }

    const result = categorySchema.safeParse(raw)
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      return
    }

    setErrors({})
    startTransition(async () => {
      try {
        if (props.mode === 'create') {
          await createCategory(result.data)
        } else {
          await updateCategory(props.category.id, result.data)
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
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-caption text-text-tertiary hover:text-text-primary"
          >
            <Plus className="h-3 w-3" />
            Categoria
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
            {props.mode === 'create' ? 'Nova categoria' : 'Editar categoria'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <Field label="Nome" required error={errors.name}>
            <Input
              name="name"
              defaultValue={props.mode === 'edit' ? props.category.name : ''}
              placeholder="Ex: Mercado, Academia..."
              error={!!errors.name}
              autoFocus
            />
          </Field>

          <Field label="Grupo" required error={errors.groupId}>
            <Select name="groupId" defaultValue={defaultGroupId} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o grupo" />
              </SelectTrigger>
              <SelectContent>
                {props.groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Orçamento padrão" hint="Opcional">
            <CurrencyInput
              name="defaultBudget"
              defaultValue={props.mode === 'edit' ? (props.category.defaultBudget ?? '') : ''}
            />
          </Field>

          <Field
            label="Cor"
            hint="Opcional. A cor de fundo é gerada automaticamente a partir desta cor."
          >
            <div className="flex items-center gap-3">
              <input
                type="color"
                name="color"
                defaultValue={
                  props.mode === 'edit' ? (props.category.color ?? '#6b7280') : '#6b7280'
                }
                className="h-12 w-14 cursor-pointer rounded-md border border-border bg-bg-surface p-1 outline-none transition-[border-color,box-shadow] duration-fast focus:border-accent focus:shadow-[0_0_0_3px_var(--ring-accent)]"
              />
            </div>
          </Field>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
