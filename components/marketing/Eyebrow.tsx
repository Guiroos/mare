import { cn } from '@/lib/utils/cn'

/**
 * Rótulo monoespaçado que abre cada seção da landing.
 *
 * Usa `font-mono` (IBM Plex Mono) por decisão de território visual: as marcações
 * de uma tábua de maré são numéricas e monoespaçadas. Não confundir com
 * `text-label` do DS — este token é exclusivo de marketing.
 */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p className={cn('mb-3.5 font-mono text-mkt-eyebrow uppercase text-accent-text', className)}>
      {children}
    </p>
  )
}
