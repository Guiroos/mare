import { cn } from '@/lib/utils/cn'

export function PageLayout({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('space-y-8', className)}>{children}</div>
}
