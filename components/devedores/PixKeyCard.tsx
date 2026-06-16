'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useMediaQuery } from '@/hooks/use-media-query'
import { updatePixKey } from '@/lib/actions/settings'
import { cn } from '@/lib/utils/cn'

interface PixKeyCardProps {
  pixKey: string | null
}

function PixKeyForm({ pixKey, onClose }: { pixKey: string | null; onClose: () => void }) {
  const [value, setValue] = useState(pixKey ?? '')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      try {
        await updatePixKey(value.trim() || null)
        toast.success('Chave Pix salva.')
        onClose()
      } catch {
        toast.error('Erro ao salvar. Tente novamente.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Chave Pix" hint="CPF, e-mail, telefone ou chave aleatória">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="sua@chave.pix"
          autoFocus
        />
      </Field>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onClose}
          disabled={isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={isPending}>
          {isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}

export function PixKeyCard({ pixKey }: PixKeyCardProps) {
  const [open, setOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const title = pixKey ? 'Editar chave Pix' : 'Cadastrar chave Pix'
  const form = <PixKeyForm pixKey={pixKey} onClose={() => setOpen(false)} />

  return (
    <>
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-lg border p-3',
          pixKey ? 'bg-bg-surface' : 'border-dashed bg-bg-subtle'
        )}
      >
        <div className="min-w-0">
          <p className="text-caption font-medium text-text-tertiary">Sua chave Pix</p>
          <p
            className={cn(
              'mt-0.5 truncate text-body',
              pixKey ? 'font-medium text-text-primary' : 'text-text-tertiary'
            )}
          >
            {pixKey ?? 'Não cadastrada'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="shrink-0">
          {pixKey ? 'Editar' : '+ Cadastrar'}
        </Button>
      </div>

      {isDesktop ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            {form}
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={open} onOpenChange={setOpen}>
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
