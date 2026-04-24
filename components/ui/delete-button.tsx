'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useMediaQuery } from '@/hooks/use-media-query'

interface DeleteButtonProps {
  onDelete: () => Promise<void>
  title?: string
  description?: string
}

export function DeleteButton({
  onDelete,
  title = 'Excluir item',
  description = 'Essa ação não pode ser desfeita.',
}: DeleteButtonProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  function handleDelete() {
    startTransition(async () => {
      try {
        await onDelete()
        setOpen(false)
      } catch {
        toast.error('Não é possível excluir — item em uso.')
        setOpen(false)
      }
    })
  }

  const trigger = (
    <Button
      size="icon"
      variant="ghost"
      className="h-7 w-7 text-secondary hover:text-negative"
      onClick={() => setOpen(true)}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  )

  if (isDesktop) {
    return (
      <>
        {trigger}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button variant="danger" disabled={isPending} onClick={handleDelete}>
                {isPending ? '...' : 'Excluir'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <>
      {trigger}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <p className="text-body text-secondary">{description}</p>
          </DrawerHeader>
          <div className="flex flex-col gap-2 p-4">
            <Button variant="danger" disabled={isPending} onClick={handleDelete}>
              {isPending ? '...' : 'Excluir'}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
