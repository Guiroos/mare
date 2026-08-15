import { forwardRef, ReactNode, ButtonHTMLAttributes } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'positive'
  | 'surface'
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
  'outline-none cursor-pointer active:scale-[0.97] antialiased ' +
  'focus-visible:shadow-[0_0_0_3px_var(--ring-accent)] ' +
  'disabled:opacity-45 disabled:pointer-events-none'

const variants: Record<ButtonVariant, string> = {
  // text-text-inverse, não text-white, nas três variantes que escrevem texto
  // claro sobre um token de fundo sólido (issue #76 + revisão do PR #93):
  // branco fixo não acompanha o L do token por tema, e --accent/--positive/
  // --negative no escuro (57%/58%/61%) reprovam 4,5:1 sob branco (4,04-4,07).
  // --text-inverse acompanha o tema (quase-preto no escuro) e alcança >= 4,5:1
  // nos três, nos dois temas — ver __tests__/unit/focus-ring-contrast.test.ts.
  primary: 'bg-accent text-text-inverse hover:bg-accent-hover hover:shadow-sm',
  secondary: 'bg-bg-subtle text-text-primary hover:bg-bg-muted',
  outline: 'bg-transparent text-accent border-2 border-accent hover:bg-accent-subtle',
  ghost: 'bg-transparent text-text-secondary hover:bg-bg-subtle hover:text-text-primary',
  danger: 'bg-negative-subtle text-negative-text hover:bg-negative hover:text-text-inverse',
  positive: 'bg-positive text-text-inverse hover:bg-positive-hover',
  surface:
    'bg-bg-surface text-text-primary border border-border shadow-sm hover:-translate-y-px hover:border-border-strong hover:shadow-md',
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
    const cls = cn(base, variants[variant], sizes[size], className)

    // Com asChild, os filhos vão direto para o Slot: embrulhar num Fragment faria
    // o Radix clonar o Fragment e o React descartar className/disabled.
    // Nesse modo o chamador põe o ícone dentro do próprio elemento filho.
    return (
      <Comp ref={ref} className={cls} disabled={disabled || loading} {...props}>
        {asChild ? (
          children
        ) : loading ? (
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
