'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface CurrencyInputProps {
  name: string;
  defaultValue?: string | number;
  required?: boolean;
  autoFocus?: boolean;
  className?: string;
  placeholder?: string;
}

function parseToCents(value: string | number | undefined): number {
  if (!value && value !== 0) return 0;
  const str = String(value).replace(',', '.').replace(/[^\d.]/g, '');
  return Math.round(parseFloat(str || '0') * 100);
}

function formatCents(cents: number): string {
  if (cents === 0) return '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function CurrencyInput({
  name,
  defaultValue,
  required,
  autoFocus,
  className,
  placeholder,
}: CurrencyInputProps) {
  const [cents, setCents] = useState(() => parseToCents(defaultValue));

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '');
    setCents(parseInt(digits || '0', 10));
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
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
      />
      <input type="hidden" name={name} value={cents > 0 ? (cents / 100).toFixed(2) : ''} />
    </>
  );
}
