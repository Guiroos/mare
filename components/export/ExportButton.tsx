'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, Download } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Badge } from '@/components/ui/badge'
import { Button, ButtonSize } from '@/components/ui/button'

export type ExportItem = {
  label: string
  /** URL da rota de exportação, com os filtros já serializados. Ausente = desabilitado. */
  href?: string
  /** Marca o item como "Em breve" (desabilitado, com badge). */
  soon?: boolean
}

type ExportButtonProps = {
  items: ExportItem[]
  label?: string
  size?: ButtonSize
}

export function ExportButton({ items, label = 'Exportar', size = 'sm' }: ExportButtonProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" size={size}>
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
          <ChevronDown className="h-3 w-3 text-text-tertiary" />
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-52 rounded-lg border border-border bg-bg-surface p-2 shadow-lg"
          sideOffset={6}
          align="end"
        >
          {items.map((item) => {
            const disabled = item.soon || !item.href
            const itemCls = cn(
              'flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-body outline-none transition duration-fast',
              disabled
                ? 'cursor-not-allowed text-text-tertiary'
                : 'cursor-pointer text-text-primary hover:bg-bg-subtle'
            )

            if (disabled) {
              return (
                <DropdownMenu.Item
                  key={item.label}
                  disabled
                  className={itemCls}
                  onSelect={(e) => e.preventDefault()}
                >
                  {item.label}
                  {item.soon && <Badge variant="muted">Em breve</Badge>}
                </DropdownMenu.Item>
              )
            }

            return (
              <DropdownMenu.Item key={item.label} asChild>
                <a href={item.href} download className={itemCls}>
                  {item.label}
                </a>
              </DropdownMenu.Item>
            )
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
