import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

type Variant = 'primary' | 'ghost'
type Size = 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-text-inverse shadow-sm hover:bg-accent-hover active:translate-y-px',
  ghost: 'border-border-strong text-text-primary hover:bg-bg-subtle',
}

const sizes: Record<Size, string> = {
  md: 'h-11 px-4 text-mkt-micro',
  lg: 'h-12 px-6 text-[16px]',
}

/**
 * Botão da landing. Deliberadamente separado de `components/ui/button` —
 * o Button do DS é dimensionado para densidade de dashboard e fica pequeno
 * demais como CTA de hero.
 */
export function MarketingButton({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: {
  href: string
  variant?: Variant
  size?: Size
  className?: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md border border-transparent font-medium no-underline transition duration-fast',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </Link>
  )
}
