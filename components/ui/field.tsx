import { ReactNode } from 'react'
import { Label } from './label'

interface FieldProps {
  label?:    string
  hint?:     string
  error?:    string
  required?: boolean
  children:  ReactNode
  className?: string
}

export function Field({ label, hint, error, required, children, className = '' }: FieldProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <Label>
          {label}
          {required && <span className="text-negative ml-1">*</span>}
        </Label>
      )}
      {children}
      {error      && <span className="text-caption font-medium text-negative-text">{error}</span>}
      {!error && hint && <span className="text-caption text-text-tertiary">{hint}</span>}
    </div>
  )
}
