import { forwardRef, InputHTMLAttributes } from 'react'

export const inputBase = [
  'w-full font-sans text-body text-text-primary bg-bg-surface',
  'border border-border rounded-md px-4 h-12',
  'outline-none appearance-none',
  'transition-[border-color,box-shadow] duration-fast',
  'placeholder:text-text-tertiary',
  'focus:border-accent focus:shadow-[0_0_0_3px_var(--ring-accent)]',
  'disabled:opacity-50 disabled:cursor-not-allowed',
].join(' ')

export const inputErrorCls = 'border-negative focus:border-negative focus:shadow-[0_0_0_3px_var(--ring-negative)]'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error = false, className = '', ...props }, ref) => (
    <input
      ref={ref}
      className={[inputBase, error ? inputErrorCls : '', className].filter(Boolean).join(' ')}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
