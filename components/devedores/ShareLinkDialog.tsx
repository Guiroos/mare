'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Copy, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useMediaQuery } from '@/hooks/use-media-query'
import { generateShareLink } from '@/lib/actions/debtors'

type Props = {
  personId: string
  initialUrl: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ShareLinkContent({
  personId,
  initialUrl,
}: {
  personId: string
  initialUrl: string | null
}) {
  const [url, setUrl] = useState<string | null>(initialUrl)
  const [loading, setLoading] = useState(false)

  async function generate() {
    // Na primeira geração não há link anterior — avisar que "o anterior deixou
    // de funcionar" alarmaria sem motivo.
    const rotating = url !== null
    setLoading(true)
    try {
      const result = await generateShareLink(personId)
      setUrl(result.url)
      toast.success(rotating ? 'Novo link gerado. O anterior deixou de funcionar.' : 'Link gerado.')
    } catch {
      toast.error('Não foi possível gerar o link. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    if (!url) return
    await navigator.clipboard.writeText(url)
    toast.success('Link copiado!')
  }

  return (
    <div className="space-y-3">
      <p className="text-small text-text-tertiary">
        Quem abrir o link vê as cobranças em aberto desta pessoa, sem precisar de login.
      </p>

      {url ? (
        <>
          <p className="break-all rounded-md bg-bg-subtle px-3 py-2 text-small text-text-secondary">
            {url}
          </p>
          <div className="flex gap-2">
            <Button type="button" onClick={copy} className="flex-1">
              <Copy className="h-4 w-4" />
              Copiar link
            </Button>
            <Button type="button" variant="secondary" onClick={generate} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
              Gerar novo
            </Button>
          </div>
        </>
      ) : (
        <Button type="button" onClick={generate} disabled={loading}>
          {loading ? 'Gerando...' : 'Gerar link'}
        </Button>
      )}
    </div>
  )
}

export function ShareLinkDialog({ personId, initialUrl, open, onOpenChange }: Props) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const title = 'Compartilhar extrato'
  const content = <ShareLinkContent personId={personId} initialUrl={initialUrl} />

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6">{content}</div>
      </DrawerContent>
    </Drawer>
  )
}
