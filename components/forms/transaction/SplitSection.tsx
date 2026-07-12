'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Field } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils/cn'
import { formatCurrency } from '@/lib/utils/currency'
import type { TransactionSplit } from '@/lib/actions/transactions'

type Person = { id: string; name: string }

type SplitEntry = {
  personId: string
  amountCents: number
}

type Props = {
  people: Person[]
  totalCents: number
  onChange: (splits: TransactionSplit[]) => void
  onIntegralChange?: (integral: boolean) => void
}

function computeEqualShare(totalCents: number, count: number): number {
  if (count === 0) return 0
  return Math.floor(totalCents / (count + 1))
}

export function SplitSection({ people, totalCents, onChange, onIntegralChange }: Props) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<SplitEntry[]>([])
  const [integral, setIntegral] = useState(false)

  useEffect(() => {
    if (!open) {
      onChange([])
      return
    }
    onChange(
      entries
        .filter((e) => e.personId && e.amountCents > 0)
        .map((e) => ({
          personId: e.personId,
          amount: (e.amountCents / 100).toFixed(2),
        }))
    )
  }, [entries, open, onChange])

  function addPerson() {
    setEntries((prev) => {
      const next = [...prev, { personId: '', amountCents: 0 }]
      return rebalance(next, totalCents)
    })
  }

  function removePerson(idx: number) {
    setEntries((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      return rebalance(next, totalCents)
    })
  }

  function setPersonId(idx: number, personId: string) {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, personId } : e)))
  }

  function setAmount(idx: number, amountCents: number) {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, amountCents } : e)))
  }

  function handleOpen() {
    setOpen(true)
    const equalShare = computeEqualShare(totalCents, 1)
    setEntries([{ personId: '', amountCents: equalShare }])
  }

  function handleClose() {
    setOpen(false)
    setEntries([])
    setIntegral(false)
    onIntegralChange?.(false)
  }

  function handleIntegralChange(v: boolean) {
    setIntegral(v)
    onIntegralChange?.(v)
  }

  const totalSplitCents = entries.reduce((s, e) => s + e.amountCents, 0)
  const yourShareCents = totalCents - totalSplitCents

  const usedPersonIds = new Set(entries.map((e) => e.personId).filter(Boolean))

  if (!open) {
    if (people.length === 0) return null
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="w-full justify-start gap-2 border-dashed text-text-secondary hover:text-text-primary"
      >
        <Users className="h-4 w-4 flex-shrink-0" />
        Dividir com alguém
      </Button>
    )
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-bg-subtle p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-small font-medium text-text-primary">
          <Users className="h-4 w-4" />
          <span>Dividir com</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="text-text-tertiary hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {entries.map((entry, idx) => {
          const availableForThisEntry = people.filter(
            (p) => !usedPersonIds.has(p.id) || p.id === entry.personId
          )
          return (
            <div key={idx} className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Field label={idx === 0 ? 'Pessoa' : undefined}>
                  <Combobox
                    options={availableForThisEntry.map((p) => ({ value: p.id, label: p.name }))}
                    value={entry.personId}
                    onValueChange={(v) => setPersonId(idx, v)}
                    placeholder="Selecionar..."
                  />
                </Field>
              </div>
              <div className="w-28 flex-shrink-0">
                <Field label={idx === 0 ? 'Valor' : undefined}>
                  <CurrencyInput
                    name={`split-amount-${idx}`}
                    defaultValue={entry.amountCents / 100}
                    onValueChange={(cents) => setAmount(idx, cents)}
                  />
                </Field>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removePerson(idx)}
                className="mb-0.5 flex-shrink-0 text-text-tertiary hover:text-negative"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )
        })}
      </div>

      {entries.length < people.length && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addPerson}
          className="gap-1.5 px-0 text-text-secondary hover:text-text-primary"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar pessoa
        </Button>
      )}

      <Separator />

      <div className="space-y-2">
        <Switch
          label="Registrar só a minha parte"
          checked={integral}
          onChange={handleIntegralChange}
        />
        <p className="text-caption text-text-tertiary">
          As partes das outras pessoas viram cobranças em Devedores.
        </p>
        <div className="flex items-center justify-between rounded-md bg-bg-surface px-3 py-2">
          <span className="text-small text-text-secondary">
            {integral ? 'Valor a registrar' : 'Sua parte'}
          </span>
          <span
            className={cn(
              'text-small font-semibold tabular-nums',
              yourShareCents < 0
                ? 'text-negative'
                : integral
                  ? 'text-accent-text'
                  : 'text-text-primary'
            )}
          >
            {formatCurrency(yourShareCents / 100)}
          </span>
        </div>
      </div>
    </div>
  )
}

function rebalance(entries: SplitEntry[], totalCents: number): SplitEntry[] {
  if (entries.length === 0) return entries
  const equalShare = computeEqualShare(totalCents, entries.length)
  return entries.map((e) => ({ ...e, amountCents: equalShare }))
}
