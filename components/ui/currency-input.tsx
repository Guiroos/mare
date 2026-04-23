'use client'

import { useState } from 'react'

interface CurrencyInputProps {
  name:          string
  defaultValue?: string | number
  required?:     boolean
  autoFocus?:    boolean
  className?:    string
  placeholder?:  string
  error?:        boolean
}

function parseToCents(value: string | number | undefined): number {
  if (!value && value !== 0) return 0
  const str = String(value).replace(',', '.').replace(/[^\d.]/g, '')
  return Math.round(parseFloat(str || '0') * 100)
}

function formatCents(cents: number): string {
  if (cents === 0) return ''
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

const inputBase = [
  'w-full font-sans text-body text-text-primary bg-bg-surface',
  'border border-border rounded-md px-4 h-12',
  'outline-none appearance-none',
  'transition-[border-color,box-shadow] duration-fast',
  'placeholder:text-text-tertiary',
  'focus:border-accent focus:shadow-[0_0_0_3px_var(--ring-accent)]',
  'disabled:opacity-50 disabled:cursor-not-allowed',
].join(' ')

const errorCls = 'border-negative focus:border-negative focus:shadow-[0_0_0_3px_var(--ring-negative)]'

export function CurrencyInput({
  name,
  defaultValue,
  required,
  autoFocus,
  className = '',
  placeholder,
  error = false,
}: CurrencyInputProps) {
  const [cents, setCents] = useState(() => parseToCents(defaultValue))

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    setCents(parseInt(digits || '0', 10))
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
        className={[inputBase, error ? errorCls : '', className].filter(Boolean).join(' ')}
      />
      <input type="hidden" name={name} value={cents > 0 ? (cents / 100).toFixed(2) : ''} />
    </>
  )
}
