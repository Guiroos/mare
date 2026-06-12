'use client'

import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils/cn'

export type ComboboxOption = {
  value: string
  label: string
}

export type ComboboxGroup = {
  id: string
  label: string
  options: ComboboxOption[]
}

type Props = {
  groups?: ComboboxGroup[]
  options?: ComboboxOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  error?: boolean
  className?: string
}

export function Combobox({
  groups,
  options,
  value,
  onValueChange,
  placeholder = 'Buscar...',
  error,
  className,
}: Props) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const flatOptions: ComboboxOption[] = groups ? groups.flatMap((g) => g.options) : (options ?? [])
  const selectedOption = flatOptions.find((o) => o.value === value)

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  const filtered = query
    ? flatOptions.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : flatOptions

  const filteredGroups: ComboboxGroup[] = groups
    ? groups
        .map((g) => ({
          ...g,
          options: g.options.filter((o) => filtered.some((f) => f.value === o.value)),
        }))
        .filter((g) => g.options.length > 0)
    : [{ id: '__flat__', label: '', options: filtered }]

  const visibleOptions = filteredGroups.flatMap((g) => g.options)
  const optionIndexMap = new Map(visibleOptions.map((o, i) => [o.value, i]))

  // Keep highlighted option scrolled into view during keyboard navigation
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>('[data-highlighted="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex])

  const handleSelect = (option: ComboboxOption) => {
    onValueChange(option.value)
    setQuery(option.label)
    setIsOpen(false)
  }

  const handleClear = () => {
    onValueChange('')
    setQuery('')
    setHighlightedIndex(0)
    setIsOpen(true)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    if (value) onValueChange('')
    setHighlightedIndex(0)
    setIsOpen(true)
  }

  const handleFocus = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setHighlightedIndex(0)
    setIsOpen(true)
  }

  const handleBlur = () => {
    closeTimer.current = setTimeout(() => setIsOpen(false), 150)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((i) => Math.min(i + 1, visibleOptions.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        if (visibleOptions[highlightedIndex]) {
          e.preventDefault()
          handleSelect(visibleOptions[highlightedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        e.currentTarget.blur()
        break
    }
  }

  const showGroups = !!groups

  return (
    <div className={cn('space-y-1', className)}>
      <div className="relative">
        <Input
          value={selectedOption ? selectedOption.label : query}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          error={error}
          autoComplete="off"
        />
        {value && (
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label="Limpar seleção"
            className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
            onMouseDown={(e) => {
              e.preventDefault()
              handleClear()
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {isOpen && (
        <div
          ref={listRef}
          className="max-h-48 overflow-y-auto rounded-md border border-border bg-bg-surface shadow-sm"
        >
          {visibleOptions.length === 0 ? (
            <p className="px-3 py-2 text-small text-text-tertiary">Nenhum resultado encontrado</p>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.id}>
                {showGroups && group.label && (
                  <p className="bg-bg-subtle px-3 py-1.5 text-caption font-medium text-text-tertiary">
                    {group.label}
                  </p>
                )}
                {group.options.map((option) => {
                  const idx = optionIndexMap.get(option.value) ?? -1
                  const isHighlighted = idx === highlightedIndex
                  const isSelected = value === option.value
                  return (
                    <Button
                      key={option.value}
                      variant="ghost"
                      type="button"
                      data-highlighted={isHighlighted ? 'true' : undefined}
                      className={cn(
                        'h-9 w-full justify-start rounded-sm px-3 text-body font-normal transition-colors duration-fast',
                        isHighlighted && !isSelected && 'bg-bg-subtle',
                        isSelected && 'bg-accent-subtle text-accent-text hover:bg-accent-subtle'
                      )}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        handleSelect(option)
                      }}
                    >
                      {option.label}
                    </Button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
