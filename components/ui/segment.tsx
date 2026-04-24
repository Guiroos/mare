'use client'
import { ReactNode, useState } from 'react'

export interface SegmentOption<T extends string = string> {
  value: T
  label: ReactNode
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
      className={`inline-flex gap-0.5 rounded-md border border-border bg-bg-subtle p-1 ${className}`}
    >
      {options.map((opt) => {
        const isActive = active === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              setInternal(opt.value)
              onChange?.(opt.value)
            }}
            className={
              'flex-1 cursor-pointer whitespace-nowrap rounded-sm px-4 py-2 text-center text-small font-medium ' +
              'border-0 transition duration-fast ' +
              (isActive
                ? 'bg-bg-surface text-text-primary shadow-sm'
                : 'bg-transparent text-text-secondary')
            }
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
