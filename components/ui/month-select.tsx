'use client'

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { currentYearMonth, formatMonthYear, monthOptions } from '@/lib/utils/date'

type Props = {
  name: string
  defaultValue?: string
  error?: boolean
  back?: number
  forward?: number
}

export function MonthSelect({ name, defaultValue, error, back = 12, forward = 12 }: Props) {
  const initial = defaultValue ?? currentYearMonth()
  const [value, setValue] = useState(initial)
  const options = monthOptions(initial, back, forward)
  // garante que o valor atual esteja nas opções mesmo se fora da janela
  const allOptions = options.includes(value) ? options : [value, ...options]

  return (
    <>
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger error={error} className="bg-bg-input">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allOptions.map((ym) => (
            <SelectItem key={ym} value={ym}>
              {formatMonthYear(ym)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name={name} value={value} />
    </>
  )
}
