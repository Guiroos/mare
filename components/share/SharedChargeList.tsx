'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Section } from '@/components/ui/section'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate, formatMonthShort, uniqueMonthsFromDates } from '@/lib/utils/date'
import type { OpenChargeForLinking } from '@/lib/queries/debtors'

export function SharedChargeList({ charges }: { charges: OpenChargeForLinking[] }) {
  /* Deriva de `entryDate`, não de `referenceMonth` — o mesmo helper que
     `OpenChargesPicker` usa, para que o mês visto aqui seja o mesmo que o dono
     vê no dialog de cobrança. */
  const months = uniqueMonthsFromDates(charges.map((c) => c.entryDate))
  const [activeMonth, setActiveMonth] = useState<string>('all')

  const visible =
    activeMonth === 'all' ? charges : charges.filter((c) => c.entryDate.startsWith(activeMonth))

  return (
    <Section
      title="Cobranças em aberto"
      action={
        months.length > 1 ? (
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
        ) : undefined
      }
    >
      <Card padding="none">
        <ul className="divide-y divide-border">
          {visible.map((charge) => (
            <li key={charge.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-body text-text-primary">{charge.description}</p>
                <p className="text-caption text-text-tertiary">{formatDate(charge.entryDate)}</p>
              </div>
              <span className="shrink-0 text-body tabular-nums text-text-primary">
                {formatCurrency(charge.amount)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  )
}
