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
  id?: string
  name: string
  defaultValue?: string
  error?: boolean
  back?: number
  forward?: number
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

export function MonthSelect({
  id,
  name,
  defaultValue,
  error,
  back = 12,
  forward = 12,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: Props) {
  const initial = defaultValue ?? currentYearMonth()
  const [value, setValue] = useState(initial)
  const options = monthOptions(initial, back, forward)
  // garante que o valor atual esteja nas opções mesmo se fora da janela
  const allOptions = options.includes(value) ? options : [value, ...options]

  return (
    <>
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger
          id={id}
          error={error}
          className="bg-bg-input"
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
        >
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
