import { forwardRef, LabelHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className = '', ...props }, ref) => (
    <label
      ref={ref}
      className={cn('text-caption font-medium text-text-secondary', className)}
      {...props}
    />
  )
)
Label.displayName = 'Label'
