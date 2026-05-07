'use client'
import { ReactNode, useState } from 'react'
import { cn } from '@/lib/utils/cn'

export interface SegmentOption<T extends string = string> {
  value: T
  label: ReactNode
  activeClassName?: string
}

interface SegmentProps<T extends string = string> {
  options: SegmentOption<T>[]
  value?: T
  onChange?: (v: T) => void
  className?: string
}

export function Segment<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: SegmentProps<T>) {
  const [internal, setInternal] = useState<T>(options[0]?.value)
  const active = value ?? internal

  return (
    <div
      className={cn(
        'inline-flex gap-0.5 rounded-md border border-border bg-bg-subtle p-1',
        className
      )}
    >
      {options.map((opt) => {
        const isActive = active === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={(e) => {
              setInternal(opt.value)
              onChange?.(opt.value)
              e.currentTarget.scrollIntoView({
                behavior: 'smooth',
                inline: 'nearest',
                block: 'nearest',
              })
            }}
            className={cn(
              'flex flex-1 cursor-pointer items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-small font-medium',
              'border-0 transition duration-fast',
              isActive
                ? cn('bg-bg-surface shadow-sm', opt.activeClassName ?? 'text-text-primary')
                : 'bg-transparent text-text-secondary hover:text-text-primary'
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
