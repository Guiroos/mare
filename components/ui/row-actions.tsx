'use client'

import { useState, useTransition } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { MoreVertical } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from './button'
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

interface RowActionsProps {
  onEdit: () => void
  onDelete: () => Promise<void>
  deleteTitle?: string
  deleteDescription?: string
}

export function RowActions({
  onEdit,
  onDelete,
  deleteTitle = 'Excluir item',
  deleteDescription = 'Essa ação não pode ser desfeita.',
}: RowActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  function handleDelete() {
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
            className="h-7 w-7 flex-shrink-0 text-text-secondary opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100"
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
            <DropdownMenu.Item
              className="flex cursor-pointer items-center px-3 py-2 text-small text-text-primary outline-none transition-colors hover:bg-bg-subtle focus:bg-bg-subtle"
              onSelect={onEdit}
            >
              Editar
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="flex cursor-pointer items-center px-3 py-2 text-small text-negative-text outline-none transition-colors hover:bg-negative-subtle focus:bg-negative-subtle"
              onSelect={() => setConfirmOpen(true)}
            >
              Excluir
            </DropdownMenu.Item>
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
