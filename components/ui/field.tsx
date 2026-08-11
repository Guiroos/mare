import { ReactElement, ReactNode, cloneElement, isValidElement, useId } from 'react'
import { Label } from './label'
import { cn } from '@/lib/utils/cn'

interface FieldProps {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
}

interface ControlProps {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

export function Field({ label, hint, error, required, children, className = '' }: FieldProps) {
  const controlId = useId()
  const descId = useId()
  const hasDescription = Boolean(error || hint)

  const control = isValidElement<ControlProps>(children)
    ? cloneElement(children as ReactElement<ControlProps>, {
        id: controlId,
        'aria-describedby': hasDescription ? descId : undefined,
        'aria-invalid': !!error,
      })
    : children

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <Label htmlFor={controlId}>
          {label}
          {required && <span className="ml-1 text-negative">*</span>}
        </Label>
      )}
      {control}
      {error && (
        <span id={descId} className="text-caption font-medium text-negative">
          {error}
        </span>
      )}
      {!error && hint && (
        <span id={descId} className="text-caption text-text-tertiary">
          {hint}
        </span>
      )}
    </div>
  )
}
