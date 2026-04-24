import { forwardRef, ReactNode, ButtonHTMLAttributes } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { Loader2 } from 'lucide-react'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'positive'
export type ButtonSize = 'lg' | 'md' | 'sm' | 'xs' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  children?: ReactNode
}

const base =
  'inline-flex items-center justify-center gap-2 font-sans font-medium whitespace-nowrap ' +
  'transition-[background,color,transform,box-shadow] duration-fast ease-out ' +
  'outline-none border-none cursor-pointer active:scale-[0.97] antialiased ' +
  'disabled:opacity-45 disabled:pointer-events-none'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover hover:shadow-sm',
  secondary: 'bg-bg-subtle text-text-primary hover:bg-bg-muted',
  outline: 'bg-transparent text-accent border-2 border-accent hover:bg-accent-subtle',
  ghost: 'bg-transparent text-text-secondary hover:bg-bg-subtle hover:text-text-primary',
  danger: 'bg-negative-subtle text-negative-text hover:bg-negative hover:text-white',
  positive: 'bg-positive text-white hover:bg-positive-hover',
}

const sizes: Record<ButtonSize, string> = {
  lg: 'h-14 px-6 rounded-md text-body-lg',
  md: 'h-11 px-5 rounded-md text-body',
  sm: 'h-8 px-4 rounded-sm text-small',
  xs: 'h-7 px-3 rounded-sm text-caption',
  icon: 'h-9 w-9 p-0 rounded-md',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      asChild = false,
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button'
    const cls = [base, variants[variant], sizes[size], className].filter(Boolean).join(' ')

    return (
      <Comp ref={ref} className={cls} disabled={disabled || loading} {...props}>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
      </Comp>
    )
  }
)
Button.displayName = 'Button'
