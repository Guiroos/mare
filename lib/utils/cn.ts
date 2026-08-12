import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        'text-display',
        'text-h1',
        'text-h2',
        'text-h3',
        'text-body-lg',
        'text-body',
        'text-small',
        'text-caption',
        'text-label',
        'text-amount',
        'text-mkt-hero',
        'text-mkt-h2',
        'text-mkt-h3',
        'text-mkt-lead',
        'text-mkt-body',
        'text-mkt-small',
        'text-mkt-micro',
        'text-mkt-stat',
        'text-mkt-eyebrow',
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
