'use client'

import { useState } from 'react'
import { Copy, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useMediaQuery } from '@/hooks/use-media-query'
import { formatCurrency } from '@/lib/utils/currency'
import { buildDebtMessage } from '@/lib/utils/debtMessage'
import { formatPhoneForWhatsApp } from '@/lib/utils/phone'
import type { OpenChargeForLinking } from '@/lib/queries/debtors'

interface CobrancaDialogProps {
  person: { id: string; name: string; phone: string | null }
  openCharges: OpenChargeForLinking[]
  pixKey: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEditPhone?: () => void
}

function CobrancaContent({
  person,
  openCharges,
  pixKey,
  onClose,
  onEditPhone,
}: {
  person: { id: string; name: string; phone: string | null }
  openCharges: OpenChargeForLinking[]
  pixKey: string | null
  onClose: () => void
  onEditPhone?: () => void
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(openCharges.map((c) => c.id))
  )

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selected = openCharges.filter((c) => selectedIds.has(c.id))
  const total = selected.reduce((sum, c) => sum + c.amount, 0)
  const message = buildDebtMessage(person.name, selected, pixKey)
  const hasSelection = selected.length > 0

  function handleWhatsApp() {
    const url = `https://wa.me/${formatPhoneForWhatsApp(person.phone!)}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
    onClose()
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(message)
    toast.success('Mensagem copiada!')
  }

  return (
    <div className="space-y-4">
      {!person.phone && (
        <div
          className="rounded-lg border p-3 text-small text-text-secondary"
          style={{
            borderColor: 'var(--warning)',
            background: 'color-mix(in oklch, var(--warning) 10%, transparent)',
          }}
        >
          <span className="font-medium text-text-primary">{person.name}</span> não tem telefone
          cadastrado. Copie a mensagem abaixo e envie manualmente.
          {onEditPhone && (
            <>
              {' '}
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-auto p-0 text-accent underline-offset-4 hover:underline"
                onClick={() => {
                  onClose()
                  onEditPhone()
                }}
              >
                Cadastrar telefone →
              </Button>
            </>
          )}
        </div>
      )}

      <div>
        <p className="mb-2 text-caption font-medium text-text-tertiary">Cobranças em aberto</p>
        <div className="space-y-0.5">
          {openCharges.map((charge) => (
            <Label
              key={charge.id}
              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-bg-subtle"
            >
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-accent"
                checked={selectedIds.has(charge.id)}
                onChange={() => toggle(charge.id)}
              />
              <span className="min-w-0 flex-1 truncate text-body">{charge.description}</span>
              <span className="shrink-0 text-small text-text-tertiary">
                {new Date(charge.entryDate + 'T12:00:00').toLocaleDateString('pt-BR')}
              </span>
              <span className="shrink-0 text-body tabular-nums">
                {formatCurrency(charge.amount)}
              </span>
            </Label>
          ))}
          {openCharges.length === 0 && (
            <p className="py-2 text-small text-text-tertiary">Nenhuma cobrança em aberto.</p>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-caption font-medium text-text-tertiary">Preview da mensagem</p>
        <div className="whitespace-pre-wrap rounded-lg bg-bg-subtle p-3 text-small leading-relaxed text-text-secondary">
          {hasSelection ? (
            message
          ) : (
            <span className="italic text-text-tertiary">Selecione ao menos uma cobrança.</span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-small tabular-nums text-text-tertiary">
          {selected.length} selecionada{selected.length !== 1 ? 's' : ''} · {formatCurrency(total)}
        </span>
        {person.phone ? (
          <Button
            variant="positive"
            disabled={!hasSelection}
            onClick={handleWhatsApp}
            className="gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            Abrir WhatsApp
          </Button>
        ) : (
          <Button
            variant="secondary"
            disabled={!hasSelection}
            onClick={handleCopy}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            Copiar mensagem
          </Button>
        )}
      </div>
    </div>
  )
}

export function CobrancaDialog({
  person,
  openCharges,
  pixKey,
  open,
  onOpenChange,
  onEditPhone,
}: CobrancaDialogProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const title = 'Cobrar via WhatsApp'
  const subtitle = `${person.name} · ${person.phone ?? 'sem telefone'}`

  const content = (
    <CobrancaContent
      person={person}
      openCharges={openCharges}
      pixKey={pixKey}
      onClose={() => onOpenChange(false)}
      onEditPhone={onEditPhone}
    />
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <p className="text-small text-text-tertiary">{subtitle}</p>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <p className="text-small text-text-tertiary">{subtitle}</p>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-6">{content}</div>
      </DrawerContent>
    </Drawer>
  )
}
