'use client'

import { createContext, useContext, useSyncExternalStore, useCallback, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils/currency'

const STORAGE_KEY = 'mare:privacy-mode'

function getSnapshot(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

function getServerSnapshot(): boolean {
  return false
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

type PrivacyModeCtx = {
  isPrivate: boolean
  toggle: () => void
}

const ctx = createContext<PrivacyModeCtx>({ isPrivate: false, toggle: () => {} })

/** Pure helper — testable without React. */
export function maskValue(value: number, isPrivate: boolean): string {
  return isPrivate ? 'R$ ••••' : formatCurrency(value)
}

export function usePrivacyMode() {
  const { isPrivate, toggle } = useContext(ctx)
  return { isPrivate, toggle, mask: (value: number) => maskValue(value, isPrivate) }
}

export function PrivacyModeProvider({ children }: { children: ReactNode }) {
  const isPrivate = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggle = useCallback(() => {
    const next = localStorage.getItem(STORAGE_KEY) !== 'true'
    localStorage.setItem(STORAGE_KEY, String(next))
    // Dispatch a storage event so useSyncExternalStore listeners are notified
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
  }, [])

  return <ctx.Provider value={{ isPrivate, toggle }}>{children}</ctx.Provider>
}

export function SensitiveAmount({ value, className }: { value: number; className?: string }) {
  const { isPrivate } = useContext(ctx)
  return <span className={className}>{maskValue(value, isPrivate)}</span>
}

export function SensitiveMoneyBadge({
  value,
  variant,
  size = 'sm',
}: {
  value: number
  variant: 'positive' | 'muted'
  size?: 'sm'
}) {
  const { mask } = usePrivacyMode()
  if (value <= 0) return null
  return (
    <Badge variant={variant} size={size}>
      {mask(value)}
    </Badge>
  )
}

export function PrivacyToggle() {
  const { isPrivate, toggle } = useContext(ctx)
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isPrivate ? 'Mostrar valores' : 'Ocultar valores'}
    >
      {isPrivate ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </Button>
  )
}
