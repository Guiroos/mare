'use client'

import { useState, type ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResponsiveDialog } from '@/components/ui/responsive-dialog'

/**
 * Lápis + diálogo responsivo de edição. Sem `open`, controla o próprio estado e
 * renderiza o lápis; com `open`/`onOpenChange`, o pai controla e o lápis some.
 */
export function EditDialogShell({
  title,
  className,
  scrollableDrawer = true,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  children,
}: {
  title: string
  className: string
  /** Drawer com altura máxima e corpo rolável (forms longos). */
  scrollableDrawer?: boolean
  open?: boolean
  onOpenChange?: (v: boolean) => void
  children: (close: () => void) => ReactNode
}) {
  const [internalOpen, setInternalOpen] = useState(false)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen

  return (
    <>
      {!isControlled && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-text-secondary hover:text-text-primary"
          onClick={() => setOpen(true)}
          aria-label="Editar"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        className={className}
        drawerClassName={scrollableDrawer ? 'max-h-[92dvh]' : undefined}
        drawerBodyClassName={scrollableDrawer ? 'overflow-y-auto px-4 pb-6' : undefined}
      >
        {children(() => setOpen(false))}
      </ResponsiveDialog>
    </>
  )
}
