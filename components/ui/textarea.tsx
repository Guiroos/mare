import { forwardRef, TextareaHTMLAttributes } from 'react'
import { inputBase, inputErrorCls } from './input'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error = false, rows = 4, className = '', ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={[
        inputBase,
        '!h-auto py-3 resize-none',
        error ? inputErrorCls : '',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'
