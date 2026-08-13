'use client'

import { useState } from 'react'
import { Section } from '@/components/ui/section'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ListFooter, TxList } from '@/components/ui/tx-list'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate, formatMonthShort, uniqueMonthsFromDates } from '@/lib/utils/date'
import type { OpenChargeForLinking } from '@/lib/queries/debtors'

const ALL_MONTHS = 'all'

/* Exportada para teste: a seleção e a soma são a regra desta tela, e o repo
   não tem infra de render de componente (ver `row-actions.test.ts`). Mesmo
   padrão de `maskValue` em `components/providers/PrivacyMode`. */
export function chargesForMonth(
  charges: OpenChargeForLinking[],
  activeMonth: string
): { visible: OpenChargeForLinking[]; total: number } {
  const visible =
    activeMonth === ALL_MONTHS
      ? charges
      : charges.filter((c) => c.entryDate.startsWith(activeMonth))

  return { visible, total: visible.reduce((sum, c) => sum + c.amount, 0) }
}

export function SharedChargeList({ charges }: { charges: OpenChargeForLinking[] }) {
  /* Deriva de `entryDate`, não de `referenceMonth` — o mesmo helper que
     `OpenChargesPicker` usa, para que o mês visto aqui seja o mesmo que o dono
     vê no dialog de cobrança. */
  const months = uniqueMonthsFromDates(charges.map((c) => c.entryDate))
  const [activeMonth, setActiveMonth] = useState<string>(ALL_MONTHS)

  /* O total só aparece quando há filtro: em "Todos os meses" ele seria idêntico
     ao card "Total em aberto" logo acima. */
  const isFiltered = activeMonth !== ALL_MONTHS
  const { visible, total } = chargesForMonth(charges, activeMonth)

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
              <SelectItem value={ALL_MONTHS}>Todos os meses</SelectItem>
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
      <TxList>
        <ul className="divide-y divide-border">
          {visible.map((charge) => (
            <li key={charge.id} className="flex items-center gap-3 px-5 py-3">
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
        {isFiltered && (
          <ListFooter
            label={`Total de ${formatMonthShort(activeMonth)}`}
            value={formatCurrency(total)}
          />
        )}
      </TxList>
    </Section>
  )
}
