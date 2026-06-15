'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export type MultiselectOption = {
  value: string
  label: string
  group?: string
}

type Props = {
  label: string
  options: MultiselectOption[]
  selected: string[]
  onChange: (next: string[]) => void
  className?: string
}

export function MultiselectDropdown({ label, options, selected, onChange, className }: Props) {
  const allValues = options.map((o) => o.value)
  const activeCount = selected.filter((v) => allValues.includes(v)).length
  const isPartial = activeCount > 0 && activeCount < allValues.length

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  // Group options by optional group label
  const groups: { group: string | null; items: MultiselectOption[] }[] = []
  for (const opt of options) {
    const key = opt.group ?? null
    const existing = groups.find((g) => g.group === key)
    if (existing) existing.items.push(opt)
    else groups.push({ group: key, items: [opt] })
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-caption transition-colors duration-fast',
            isPartial
              ? 'border-accent text-accent-text'
              : 'border-border text-text-secondary hover:border-border-strong',
            className
          )}
        >
          {label}
          {isPartial && (
            <span className="rounded-full bg-accent px-1.5 text-label font-bold text-white">
              {activeCount}
            </span>
          )}
          <ChevronDown className="h-3 w-3 text-text-tertiary" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-48 rounded-lg border border-border bg-bg-surface p-2 shadow-lg"
          sideOffset={6}
          align="start"
        >
          {groups.map(({ group, items }, gi) => (
            <div key={group ?? '__root'}>
              {gi > 0 && <DropdownMenu.Separator className="my-1 h-px bg-border" />}
              {group && (
                <DropdownMenu.Label className="px-2 py-1 text-label uppercase text-text-tertiary">
                  {group}
                </DropdownMenu.Label>
              )}
              {items.map((opt) => (
                <DropdownMenu.CheckboxItem
                  key={opt.value}
                  checked={selected.includes(opt.value)}
                  onCheckedChange={() => toggle(opt.value)}
                  className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-small text-text-primary outline-none transition-colors hover:bg-bg-subtle"
                  onSelect={(e) => e.preventDefault()}
                >
                  <DropdownMenu.ItemIndicator>
                    <span className="block h-3.5 w-3.5 rounded-sm border border-accent bg-accent" />
                  </DropdownMenu.ItemIndicator>
                  <span
                    className={cn(
                      'flex h-3.5 w-3.5 items-center justify-center rounded-sm border',
                      selected.includes(opt.value) ? 'hidden' : 'border-border'
                    )}
                  />
                  {opt.label}
                </DropdownMenu.CheckboxItem>
              ))}
            </div>
          ))}

          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <div className="flex justify-between px-2 py-1">
            <button
              onClick={() => onChange([])}
              className="text-caption text-text-tertiary hover:text-text-secondary"
            >
              Limpar
            </button>
            <button
              onClick={() => onChange(allValues)}
              className="text-caption text-accent-text hover:opacity-80"
            >
              Todos
            </button>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
