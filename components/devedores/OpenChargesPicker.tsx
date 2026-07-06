'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate, formatMonthShort } from '@/lib/utils/date'
import type { OpenChargeForLinking } from '@/lib/queries/debtors'

function getUniqueMonths(charges: OpenChargeForLinking[]): string[] {
  const months = new Set(charges.map((c) => c.entryDate.slice(0, 7)))
  return [...months].sort((a, b) => b.localeCompare(a))
}

type Props = {
  charges: OpenChargeForLinking[]
  selectedIds: Set<string>
  onSelectionChange: (next: Set<string>) => void
  showBulkControls?: boolean
  maxHeight?: string
}

export function OpenChargesPicker({
  charges,
  selectedIds,
  onSelectionChange,
  showBulkControls = false,
  maxHeight = 'max-h-48',
}: Props) {
  const months = getUniqueMonths(charges)
  const [activeMonth, setActiveMonth] = useState<string>(months[0] ?? 'all')

  const visibleCharges =
    activeMonth === 'all' ? charges : charges.filter((c) => c.entryDate.startsWith(activeMonth))

  function toggle(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange(next)
  }

  function selectVisible() {
    const next = new Set(selectedIds)
    for (const c of visibleCharges) next.add(c.id)
    onSelectionChange(next)
  }

  function clearVisible() {
    const next = new Set(selectedIds)
    for (const c of visibleCharges) next.delete(c.id)
    onSelectionChange(next)
  }

  return (
    <div className="space-y-2">
      {(months.length > 1 || showBulkControls) && (
        <div className="flex items-center justify-end gap-1">
          {months.length > 1 && (
            <Select value={activeMonth} onValueChange={setActiveMonth}>
              <SelectTrigger className="h-8 w-auto bg-bg-input px-3 text-small">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatMonthShort(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {showBulkControls && (
            <>
              <Button type="button" variant="ghost" size="xs" onClick={selectVisible}>
                Selecionar tudo
              </Button>
              <Button type="button" variant="ghost" size="xs" onClick={clearVisible}>
                Limpar
              </Button>
            </>
          )}
        </div>
      )}

      <div className={`${maxHeight} space-y-0.5 overflow-y-auto`}>
        {visibleCharges.map((charge) => (
          <Label
            key={charge.id}
            className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 font-normal hover:bg-bg-subtle"
          >
            <input
              type="checkbox"
              className="h-4 w-4 shrink-0 accent-accent"
              checked={selectedIds.has(charge.id)}
              onChange={() => toggle(charge.id)}
            />
            <span className="min-w-0 flex-1 truncate text-small text-text-primary">
              {charge.description}
            </span>
            <span className="shrink-0 text-small text-text-tertiary">
              {formatDate(charge.entryDate)}
            </span>
            <span className="shrink-0 text-small tabular-nums text-text-secondary">
              {formatCurrency(charge.amount)}
            </span>
          </Label>
        ))}
        {visibleCharges.length === 0 && (
          <p className="py-2 text-small text-text-tertiary">Nenhuma cobrança em aberto.</p>
        )}
      </div>
    </div>
  )
}
