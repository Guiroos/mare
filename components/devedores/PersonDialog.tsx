'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { toast } from 'sonner'
import { createPerson, updatePerson, archivePerson } from '@/lib/actions/debtors'
import { personSchema } from '@/lib/validations/debtors'
import { formatZodErrors } from '@/lib/validations/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { useMediaQuery } from '@/hooks/use-media-query'

type Props =
  | { mode: 'create' }
  | {
      mode: 'edit'
      person: {
        id: string
        name: string
        email: string | null
        phone: string | null
        notes: string | null
      }
      balance: number
      open?: boolean
      onOpenChange?: (v: boolean) => void
    }

export function PersonDialog(props: Props) {
  const controlled = props.mode === 'edit' && props.open !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlled ? props.open! : internalOpen
  const setOpen = controlled ? props.onOpenChange! : setInternalOpen

  const [isPending, startTransition] = useTransition()
  const [isArchiving, startArchiveTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const handleOpenChange = (v: boolean) => {
    setOpen(v)
    if (!v) {
      setErrors({})
      setShowArchiveConfirm(false)
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data = {
      name: (fd.get('name') as string).trim(),
      email: (fd.get('email') as string).trim() || undefined,
      phone: (fd.get('phone') as string).trim() || undefined,
      notes: (fd.get('notes') as string).trim() || undefined,
    }

    const result = personSchema.safeParse(data)
    if (!result.success) {
      setErrors(formatZodErrors(result.error))
      return
    }

    setErrors({})
    startTransition(async () => {
      try {
        if (props.mode === 'edit') {
          await updatePerson({ id: props.person.id, ...result.data })
        } else {
          await createPerson(result.data)
        }
        setOpen(false)
      } catch {
        toast.error('Erro ao salvar.')
      }
    })
  }

  const handleArchive = () => {
    if (props.mode !== 'edit') return
    const hasBalance = props.balance > 0
    if (hasBalance && !showArchiveConfirm) {
      setShowArchiveConfirm(true)
      return
    }
    startArchiveTransition(async () => {
      try {
        await archivePerson(props.person.id)
        setOpen(false)
        toast.success('Pessoa arquivada.')
      } catch {
        toast.error('Erro ao arquivar.')
      }
    })
  }

  const title = props.mode === 'create' ? 'Nova pessoa' : 'Editar pessoa'

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Nome" required error={errors.name}>
        <Input
          name="name"
          defaultValue={props.mode === 'edit' ? props.person.name : ''}
          placeholder="Ex: João Silva"
          error={!!errors.name}
          autoFocus
        />
      </Field>
      <Field label="E-mail" error={errors.email}>
        <Input
          name="email"
          type="email"
          defaultValue={props.mode === 'edit' ? (props.person.email ?? '') : ''}
          placeholder="joao@exemplo.com"
          error={!!errors.email}
        />
      </Field>
      <Field label="Telefone" error={errors.phone}>
        <Input
          name="phone"
          defaultValue={props.mode === 'edit' ? (props.person.phone ?? '') : ''}
          placeholder="(11) 99999-9999"
          error={!!errors.phone}
        />
      </Field>
      <Field label="Observações" error={errors.notes}>
        <Textarea
          name="notes"
          defaultValue={props.mode === 'edit' ? (props.person.notes ?? '') : ''}
          placeholder="Informações adicionais..."
          rows={2}
        />
      </Field>

      {props.mode === 'edit' && showArchiveConfirm && (
        <div className="rounded-md border border-warning bg-warning-subtle px-3 py-2 text-small text-text-primary">
          {props.person.name} ainda tem{' '}
          <span className="font-semibold">{formatCurrency(props.balance)}</span> em aberto. Ao
          arquivá-la, esse valor não aparecerá mais no total em aberto. Deseja continuar?
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        {props.mode === 'edit' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isArchiving}
            onClick={handleArchive}
            className="text-text-tertiary"
          >
            {showArchiveConfirm ? 'Confirmar arquivamento' : 'Arquivar'}
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" size="md" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="md" disabled={isPending}>
            {props.mode === 'create' ? 'Criar' : 'Salvar'}
          </Button>
        </div>
      </div>
    </form>
  )

  const trigger =
    props.mode === 'create' ? (
      <Button variant="primary" size="md" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-4 w-4" />
        Nova pessoa
      </Button>
    ) : !controlled ? (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="mr-1.5 h-4 w-4" />
        Editar pessoa
      </Button>
    ) : null

  if (isDesktop) {
    return (
      <>
        {trigger}
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            {form}
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <>
      {trigger}
      <Drawer open={open} onOpenChange={handleOpenChange}>
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
