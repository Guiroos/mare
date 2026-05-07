'use client'

import { useState } from 'react'
import { inputBase, inputErrorCls } from './input'
import { cn } from '@/lib/utils/cn'

interface NumericInputProps {
  name: string
  defaultValue?: string | number
  required?: boolean
  autoFocus?: boolean
  className?: string
  error?: boolean
  onValueChange?: (cents: number) => void
}

function parseToCents(value: string | number | undefined): number {
  if (!value && value !== 0) return 0
  const str = String(value)
    .replace(',', '.')
    .replace(/[^\d.]/g, '')
  return Math.round(parseFloat(str || '0') * 100)
}

function formatNumber(cents: number): string {
  if (cents === 0) return ''
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function NumericInput({
  name,
  defaultValue,
  required,
  autoFocus,
  className = '',
  error = false,
  onValueChange,
}: NumericInputProps) {
  const [cents, setCents] = useState(() => parseToCents(defaultValue))

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    const newCents = parseInt(digits || '0', 10)
    setCents(newCents)
    onValueChange?.(newCents)
  }

  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        value={formatNumber(cents)}
        onChange={handleChange}
        required={required}
        autoFocus={autoFocus}
        placeholder="0,00"
        className={cn(inputBase, error && inputErrorCls, className)}
      />
      <input type="hidden" name={name} value={cents > 0 ? (cents / 100).toFixed(2) : ''} />
    </>
  )
}
