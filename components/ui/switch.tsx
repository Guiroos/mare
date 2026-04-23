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
      className={`inline-flex items-center gap-3 cursor-pointer select-none ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="absolute opacity-0 w-0 h-0"
        {...props}
      />
      <div
        className={
          'relative w-11 h-6 rounded-full transition-colors duration-base shrink-0 border ' +
          (checked ? 'bg-accent border-accent' : 'bg-bg-muted border-border')
        }
      >
        <span
          className={
            'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-base ' +
            (checked ? 'translate-x-5' : 'translate-x-0')
          }
        />
      </div>
      {label && <span className="text-body font-medium text-text-primary">{label}</span>}
    </label>
  )
}
