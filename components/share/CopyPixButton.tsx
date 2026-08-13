'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

/**
 * Feedback inline em vez de `toast`: o `<Toaster>` do sonner vive em
 * `(app)/layout.tsx` e `(auth)/layout.tsx`, e o route group `(share)` não o
 * monta de propósito — um toast aqui não apareceria.
 */
export function CopyPixButton({ pixKey }: { pixKey: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(pixKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card padding="md">
      <p className="text-caption text-text-secondary">Chave Pix</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-body text-text-primary">{pixKey}</p>
        <Button type="button" variant="secondary" size="sm" onClick={copy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
    </Card>
  )
}
