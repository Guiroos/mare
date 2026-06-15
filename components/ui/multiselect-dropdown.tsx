'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

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
        <Button
          variant="ghost"
          size="xs"
          className={cn(
            'rounded-full border hover:bg-transparent',
            isPartial
              ? 'border-accent text-accent-text hover:border-accent hover:text-accent-text'
              : 'border-border text-text-secondary hover:border-border-strong hover:text-text-secondary',
            className
          )}
        >
          {label}
          {isPartial && (
            <span className="rounded-full bg-accent px-1.5 text-label font-bold tabular-nums text-text-inverse">
              {activeCount}
            </span>
          )}
          <ChevronDown className="h-3 w-3 text-text-tertiary" />
        </Button>
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
                <DropdownMenu.Label className="px-2 py-1 text-label text-text-tertiary">
                  {group}
                </DropdownMenu.Label>
              )}
              {items.map((opt) => {
                const checked = selected.includes(opt.value)
                return (
                  <DropdownMenu.Item key={opt.value} asChild onSelect={(e) => e.preventDefault()}>
                    <Label className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-text-primary outline-none transition duration-fast hover:bg-bg-subtle">
                      <input
                        type="checkbox"
                        className="accent-accent"
                        checked={checked}
                        onChange={() => toggle(opt.value)}
                      />
                      {opt.label}
                    </Label>
                  </DropdownMenu.Item>
                )
              })}
            </div>
          ))}

          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <div className="flex justify-between px-2 py-1">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onChange([])}
              className="text-text-tertiary hover:bg-transparent hover:text-text-secondary"
            >
              Limpar
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onChange(allValues)}
              className="text-accent-text hover:bg-transparent hover:opacity-80"
            >
              Todos
            </Button>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
