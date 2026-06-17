'use client'

import { useState } from 'react'
import { Copy, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useMediaQuery } from '@/hooks/use-media-query'
import { formatCurrency } from '@/lib/utils/currency'
import { buildDebtMessage } from '@/lib/utils/debtMessage'
import { formatPhoneForWhatsApp } from '@/lib/utils/phone'
import type { OpenChargeForLinking } from '@/lib/queries/debtors'

const MONTHS_PT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

function formatMonthLabel(ym: string): string {
  const [year, month] = ym.split('-')
  return `${MONTHS_PT[parseInt(month) - 1]}/${year.slice(2)}`
}

function getUniqueMonths(charges: OpenChargeForLinking[]): string[] {
  const months = new Set(charges.map((c) => c.entryDate.slice(0, 7)))
  return [...months].sort((a, b) => b.localeCompare(a))
}

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
  const months = getUniqueMonths(openCharges)
  const mostRecentMonth = months[0] ?? 'all'

  const [activeMonth, setActiveMonth] = useState<string>(mostRecentMonth)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () =>
      new Set(
        openCharges
          .filter((c) => mostRecentMonth === 'all' || c.entryDate.startsWith(mostRecentMonth))
          .map((c) => c.id)
      )
  )

  const visibleCharges =
    activeMonth === 'all'
      ? openCharges
      : openCharges.filter((c) => c.entryDate.startsWith(activeMonth))

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const c of visibleCharges) next.add(c.id)
      return next
    })
  }

  function clearVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const c of visibleCharges) next.delete(c.id)
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
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="whitespace-nowrap text-caption font-medium text-text-tertiary">
            Cobranças em aberto
          </p>
          <div className="flex items-center gap-1">
            {months.length > 1 && (
              <Select value={activeMonth} onValueChange={setActiveMonth}>
                <SelectTrigger className="h-8 w-auto bg-bg-input px-3 text-small">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>
                      {formatMonthLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button type="button" variant="ghost" size="xs" onClick={selectAll}>
              Selecionar tudo
            </Button>
            <Button type="button" variant="ghost" size="xs" onClick={clearVisible}>
              Limpar
            </Button>
          </div>
        </div>
        <div className="max-h-48 space-y-0.5 overflow-y-auto">
          {visibleCharges.map((charge) => (
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
          {visibleCharges.length === 0 && (
            <p className="py-2 text-small text-text-tertiary">Nenhuma cobrança em aberto.</p>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-caption font-medium text-text-tertiary">Preview da mensagem</p>
        <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-bg-subtle p-3 text-small leading-relaxed text-text-secondary">
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
