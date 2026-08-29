'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Users, Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Field } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils/cn'
import { formatCurrency } from '@/lib/utils/currency'
import {
  resolveSplitAmounts,
  selectSubmittableSplits,
  SplitEntry,
  SplitMode,
} from '@/lib/utils/split'
import type { TransactionSplit } from '@/lib/actions/transactions'

type Person = { id: string; name: string }

type Props = {
  people: Person[]
  totalCents: number
  onChange: (splits: TransactionSplit[]) => void
  onIntegralChange?: (integral: boolean) => void
}

let uidCounter = 0
function nextUid(): string {
  uidCounter += 1
  return `split-${uidCounter}`
}

export function SplitSection({ people, totalCents, onChange, onIntegralChange }: Props) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<SplitEntry[]>([])
  const [integral, setIntegral] = useState(false)
  const [mode, setMode] = useState<SplitMode>('igual')
  // Sufixo da `key` dos campos de valor. O CurrencyInput guarda o valor em
  // state próprio e não reage a mudanças de `defaultValue`, então remontá-lo é
  // a única forma de exibir uma parte recalculada. Em modo igual o sufixo
  // acompanha a parte derivada; ao congelar em custom ele é preservado, para
  // que a edição em curso não perca o foco.
  const [frozenKey, setFrozenKey] = useState('')
  const [equalizeSeq, setEqualizeSeq] = useState(0)

  const resolved = resolveSplitAmounts(entries, totalCents, mode)
  const equalShare = resolved[0]?.amountCents ?? 0
  const valueKey = mode === 'igual' ? `eq-${equalShare}-${equalizeSeq}` : frozenKey

  useEffect(() => {
    if (!open) {
      onChange([])
      return
    }
    onChange(
      selectSubmittableSplits(resolveSplitAmounts(entries, totalCents, mode)).map((e) => ({
        personId: e.personId,
        amount: (e.amountCents / 100).toFixed(2),
      }))
    )
  }, [entries, totalCents, mode, open, onChange])

  function addPerson() {
    setEntries((prev) => [...prev, { uid: nextUid(), personId: '', amountCents: 0 }])
  }

  function removePerson(uid: string) {
    setEntries((prev) => prev.filter((e) => e.uid !== uid))
  }

  function setPersonId(uid: string, personId: string) {
    setEntries((prev) => prev.map((e) => (e.uid === uid ? { ...e, personId } : e)))
  }

  function setAmount(uid: string, amountCents: number) {
    // Congela as partes derivadas antes de sair do modo igual: as demais
    // linhas mantêm o valor que já estava na tela.
    setEntries((prev) =>
      resolveSplitAmounts(prev, totalCents, mode).map((e) =>
        e.uid === uid ? { ...e, amountCents } : e
      )
    )
    if (mode === 'igual') {
      setFrozenKey(valueKey)
      setMode('custom')
    }
  }

  function handleDivideEqually() {
    setMode('igual')
    setEqualizeSeq((s) => s + 1)
  }

  function handleOpen() {
    setOpen(true)
    setMode('igual')
    setEntries([{ uid: nextUid(), personId: '', amountCents: 0 }])
  }

  function handleClose() {
    setOpen(false)
    setEntries([])
    setMode('igual')
    setIntegral(false)
    onIntegralChange?.(false)
  }

  function handleIntegralChange(v: boolean) {
    setIntegral(v)
    onIntegralChange?.(v)
  }

  // Soma o mesmo conjunto que o submit: linha sem pessoa não vira cobrança e
  // não pode descontar da sua parte.
  const totalSplitCents = selectSubmittableSplits(resolved).reduce((s, e) => s + e.amountCents, 0)
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
        {resolved.map((entry, idx) => {
          const availableForThisEntry = people.filter(
            (p) => !usedPersonIds.has(p.id) || p.id === entry.personId
          )
          return (
            <div key={entry.uid} className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Field label={idx === 0 ? 'Pessoa' : undefined}>
                  <Combobox
                    options={availableForThisEntry.map((p) => ({ value: p.id, label: p.name }))}
                    value={entry.personId}
                    onValueChange={(v) => setPersonId(entry.uid, v)}
                    placeholder="Selecionar..."
                  />
                </Field>
              </div>
              <div className="w-28 flex-shrink-0">
                <Field label={idx === 0 ? 'Valor' : undefined}>
                  <CurrencyInput
                    key={`${entry.uid}-${valueKey}`}
                    name={`split-amount-${idx}`}
                    defaultValue={entry.amountCents / 100}
                    onValueChange={(cents) => setAmount(entry.uid, cents)}
                  />
                </Field>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removePerson(entry.uid)}
                className="mb-0.5 flex-shrink-0 text-text-tertiary hover:text-negative"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4">
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
        {mode === 'custom' && entries.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDivideEqually}
            className="gap-1.5 px-0 text-text-secondary hover:text-text-primary"
          >
            <Scale className="h-3.5 w-3.5" />
            Dividir igualmente
          </Button>
        )}
      </div>

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
