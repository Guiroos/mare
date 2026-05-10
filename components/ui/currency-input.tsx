'use client'

import { useState } from 'react'
import { inputBase, inputErrorCls } from './input'
import { cn } from '@/lib/utils/cn'

interface CurrencyInputProps {
  name: string
  defaultValue?: string | number
  required?: boolean
  autoFocus?: boolean
  className?: string
  placeholder?: string
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

function formatCents(cents: number): string {
  if (cents === 0) return ''
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

export function CurrencyInput({
  name,
  defaultValue,
  required,
  autoFocus,
  className = '',
  placeholder,
  error = false,
  onValueChange,
}: CurrencyInputProps) {
  const [cents, setCents] = useState(() => parseToCents(defaultValue))
  const [touched, setTouched] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTouched(true)
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
        value={formatCents(cents)}
        onChange={handleChange}
        required={required}
        autoFocus={autoFocus}
        placeholder={placeholder ?? 'R$ 0,00'}
        className={cn(inputBase, error && inputErrorCls, className)}
      />
      <input
        type="hidden"
        name={name}
        value={touched || cents > 0 ? (cents / 100).toFixed(2) : ''}
      />
    </>
  )
}
