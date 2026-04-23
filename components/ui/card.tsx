import { HTMLAttributes } from 'react'

type Padding = 'none' | 'sm' | 'md' | 'lg'

const pad: Record<Padding, string> = {
  none: '',
  sm:   'p-4',
  md:   'p-5',
  lg:   'p-6',
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: Padding
}

export function Card({ padding = 'none', className = '', ...props }: CardProps) {
  return (
    <div
      className={`bg-bg-surface border border-border rounded-lg shadow-sm ${pad[padding]} ${className}`}
      {...props}
    />
  )
}
