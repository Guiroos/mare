import { forwardRef, LabelHTMLAttributes } from 'react'

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className = '', ...props }, ref) => (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control -- htmlFor/children chegam via spread nos consumidores (ex: Field); a regra não enxerga isso estaticamente
    <label
      ref={ref}
      className={`text-caption font-medium text-text-secondary ${className}`}
      {...props}
    />
  )
)
Label.displayName = 'Label'
