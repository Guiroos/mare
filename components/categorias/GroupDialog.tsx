'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { toast } from 'sonner'
import { createCategoryGroup, updateCategoryGroup } from '@/lib/actions/categories'
import { groupSchema } from '@/lib/validations/categories'
import { formatZodErrors } from '@/lib/validations/utils'
import { useMediaQuery } from '@/hooks/use-media-query'

type Props = { mode: 'create' } | { mode: 'edit'; group: { id: string; name: string } }

export function GroupDialog(props: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const isDesktop = useMediaQuery('(min-width: 1024px)')

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

  const title = props.mode === 'create' ? 'Novo grupo' : 'Editar grupo'

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
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
  )

  return (
    <>
      {props.mode === 'create' ? (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Novo grupo
        </Button>
      ) : (
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-text-tertiary hover:text-text-primary"
          onClick={() => setOpen(true)}
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
