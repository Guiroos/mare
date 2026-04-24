import { forwardRef, LabelHTMLAttributes } from 'react'

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className = '', ...props }, ref) => (
    <label
      ref={ref}
      className={`text-caption font-medium text-text-secondary ${className}`}
      {...props}
    />
  )
)
Label.displayName = 'Label'
