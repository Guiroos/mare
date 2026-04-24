'use client'

import { useState, useTransition, useEffect, type FormEvent } from 'react'
import { Pencil } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { updateInstallmentGroup } from '@/lib/actions/transactions'
import { getRegistrationFormData } from '@/lib/actions/form-data'
import { useMediaQuery } from '@/hooks/use-media-query'

type CategoryGroup = {
  id: string
  name: string
  categories: { id: string; name: string }[]
}

type Account = {
  id: string
  name: string
  type: string
}

type InstallmentGroup = {
  id: string
  name: string
  categoryId: string
  accountId: string
}

function EditForm({
  group,
  categoryGroups,
  accounts,
  onSuccess,
}: {
  group: InstallmentGroup
  categoryGroups: CategoryGroup[]
  accounts: Account[]
  onSuccess: () => void
}) {
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const str = (name: string) => (fd.get(name) as string) ?? ''

    startTransition(async () => {
      try {
        await updateInstallmentGroup({
          id: group.id,
          name: str('name'),
          categoryId: str('categoryId'),
          accountId: str('accountId'),
        })
        onSuccess()
      } catch {
        toast.error('Erro ao salvar. Tente novamente.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Nome">
        <Input name="name" defaultValue={group.name} required />
      </Field>

      <Field label="Categoria">
        <Select name="categoryId" defaultValue={group.categoryId} required>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a categoria" />
          </SelectTrigger>
          <SelectContent>
            {categoryGroups.map((g) => (
              <SelectGroup key={g.id}>
                <SelectLabel>{g.name}</SelectLabel>
                {g.categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Conta / Cartão">
        <Select name="accountId" defaultValue={group.accountId} required>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a conta" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((acc) => (
              <SelectItem key={acc.id} value={acc.id}>
                {acc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <p className="text-xs text-muted-foreground">
        Valor e número de parcelas não podem ser alterados. Isso atualizará todas as parcelas do
        grupo.
      </p>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Salvando...' : 'Salvar alterações'}
      </Button>
    </form>
  )
}

function FormLoader({ group, onSuccess }: { group: InstallmentGroup; onSuccess: () => void }) {
  const [formData, setFormData] = useState<{
    categoryGroups: CategoryGroup[]
    accounts: Account[]
  } | null>(null)

  useEffect(() => {
    getRegistrationFormData().then(setFormData)
  }, [])

  if (!formData) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        Carregando...
      </div>
    )
  }

  return (
    <EditForm
      group={group}
      categoryGroups={formData.categoryGroups}
      accounts={formData.accounts}
      onSuccess={onSuccess}
    />
  )
}

export function InstallmentGroupEditButton({ group }: { group: InstallmentGroup }) {
  const [open, setOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const content = <FormLoader group={group} onSuccess={() => setOpen(false)} />

  if (isDesktop) {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(true)}
          aria-label="Editar"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar parcelamento</DialogTitle>
            </DialogHeader>
            {content}
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        aria-label="Editar"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader>
            <DrawerTitle>Editar parcelamento</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">{content}</div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
