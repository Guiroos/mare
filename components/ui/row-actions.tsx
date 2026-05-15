'use client'

import { useState, useTransition } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { LucideIcon, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from './button'
import { cn } from '@/lib/utils/cn'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from './drawer'
import { useMediaQuery } from '@/hooks/use-media-query'

interface AdditionalAction {
  label: string
  icon?: LucideIcon
  onClick: () => void
  variant?: 'default' | 'destructive'
}

interface RowActionsProps {
  onEdit?: () => void
  onDelete?: () => Promise<void>
  deleteTitle?: string
  deleteDescription?: string
  triggerClassName?: string
  additionalActions?: AdditionalAction[]
}

export function RowActions({
  onEdit,
  onDelete,
  deleteTitle = 'Excluir item',
  deleteDescription = 'Essa ação não pode ser desfeita.',
  triggerClassName,
  additionalActions,
}: RowActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  function handleDelete() {
    if (!onDelete) return
    startTransition(async () => {
      try {
        await onDelete()
        setConfirmOpen(false)
      } catch {
        toast.error('Não é possível excluir — item em uso.')
        setConfirmOpen(false)
      }
    })
  }

  const confirmBody = (
    <>
      <Button variant="danger" disabled={isPending} onClick={handleDelete}>
        {isPending ? '...' : 'Excluir'}
      </Button>
      <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
        Cancelar
      </Button>
    </>
  )

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7 flex-shrink-0 text-text-secondary opacity-100 transition-opacity duration-fast lg:opacity-0 lg:group-hover:opacity-100',
              triggerClassName
            )}
            aria-label="Ações"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-28 overflow-hidden rounded-md border border-border bg-bg-surface shadow-md"
          >
            {additionalActions && additionalActions.length > 0 && (
              <>
                {additionalActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <DropdownMenu.Item
                      key={action.label}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 px-3 py-2 text-small outline-none transition-colors duration-fast',
                        action.variant === 'destructive'
                          ? 'text-negative hover:bg-negative-subtle focus:bg-negative-subtle'
                          : 'text-text-primary hover:bg-bg-subtle focus:bg-bg-subtle'
                      )}
                      onSelect={action.onClick}
                    >
                      {Icon && <Icon className="h-3.5 w-3.5" />}
                      {action.label}
                    </DropdownMenu.Item>
                  )
                })}
                {(onEdit || onDelete) && <DropdownMenu.Separator className="my-1 h-px bg-border" />}
              </>
            )}
            {onEdit && (
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-small text-text-primary outline-none transition-colors duration-fast hover:bg-bg-subtle focus:bg-bg-subtle"
                onSelect={onEdit}
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </DropdownMenu.Item>
            )}
            {onDelete && (
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-small text-negative outline-none transition-colors duration-fast hover:bg-negative-subtle focus:bg-negative-subtle"
                onSelect={() => setConfirmOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {isDesktop ? (
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{deleteTitle}</DialogTitle>
              <DialogDescription>{deleteDescription}</DialogDescription>
            </DialogHeader>
            <DialogFooter>{confirmBody}</DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{deleteTitle}</DrawerTitle>
              <p className="text-body text-text-secondary">{deleteDescription}</p>
            </DrawerHeader>
            <div className="flex flex-col gap-2 p-4">{confirmBody}</div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  )
}
