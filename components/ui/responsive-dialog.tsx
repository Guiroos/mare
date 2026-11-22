'use client'

import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useMediaQuery } from '@/hooks/use-media-query'

type ResponsiveDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  /** DialogContent (desktop). */
  className?: string
  /** DrawerContent (mobile). */
  drawerClassName?: string
  /** Wrapper do corpo no Drawer; default `px-4 pb-6`. */
  drawerBodyClassName?: string
  children: ReactNode
}

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  className,
  drawerClassName,
  drawerBodyClassName = 'px-4 pb-6',
  children,
}: ResponsiveDialogProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={className}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={drawerClassName}>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <div className={drawerBodyClassName}>{children}</div>
      </DrawerContent>
    </Drawer>
  )
}
