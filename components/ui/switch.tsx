'use client'
import { InputHTMLAttributes } from 'react'

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function Switch({ label, checked, onChange, disabled, id, ...props }: SwitchProps) {
  return (
    <label
      className={`inline-flex cursor-pointer select-none items-center gap-3 ${disabled ? 'pointer-events-none opacity-50' : ''}`}
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="absolute h-0 w-0 opacity-0"
        {...props}
      />
      <div
        className={
          'relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-base ' +
          (checked ? 'border-accent bg-accent' : 'border-border bg-bg-muted')
        }
      >
        <span
          className={
            'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-base ' +
            (checked ? 'translate-x-5' : 'translate-x-0')
          }
        />
      </div>
      {label && <span className="text-body font-medium text-text-primary">{label}</span>}
    </label>
  )
}
