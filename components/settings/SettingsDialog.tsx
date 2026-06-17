'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { RotateCcw, TriangleAlert } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Segment, SegmentOption } from '@/components/ui/segment'
import { useMediaQuery } from '@/hooks/use-media-query'
import { resetAccount } from '@/lib/actions/reset-account'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const THEME_OPTIONS: SegmentOption[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
  { value: 'system', label: 'Sistema' },
]

function SettingsContent({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  function handleReset() {
    startTransition(async () => {
      try {
        await resetAccount()
        toast.success('Conta resetada com sucesso.')
        onClose()
        router.push('/dashboard')
      } catch {
        toast.error('Erro ao resetar a conta. Tente novamente.')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1 text-small font-semibold text-text-primary">Aparência</p>
        <p className="mb-3 text-small text-text-secondary">Escolha como o app deve aparecer.</p>
        <Segment
          options={THEME_OPTIONS}
          value={theme ?? 'system'}
          onChange={(v) => setTheme(v)}
          className="w-full"
        />
      </div>

      <div>
        <p className="mb-1 text-small font-semibold text-text-primary">Zona de perigo</p>
        <p className="mb-4 text-small text-text-secondary">
          Apaga todos os dados e restaura a conta ao estado inicial, mantendo as categorias padrão e
          seus orçamentos.
        </p>
        <Button
          variant="danger"
          onClick={() => setConfirming(true)}
          disabled={confirming}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Resetar conta
        </Button>

        {confirming && (
          <div className="mt-4 space-y-3 rounded-lg border border-negative bg-bg-subtle p-4">
            <div className="flex gap-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-negative" />
              <div>
                <p className="text-small font-semibold text-negative">Ação irreversível</p>
                <p className="mt-1 text-small text-text-secondary">
                  Os seguintes dados serão apagados permanentemente:
                </p>
                <ul className="mt-2 space-y-0.5 text-small text-text-secondary">
                  <li>· Transações e receitas</li>
                  <li>· Gastos fixos e parcelas</li>
                  <li>· Investimentos e metas</li>
                  <li>· Devedores e pessoas</li>
                  <li>· Contas e cartões</li>
                  <li>· Configurações do mês</li>
                </ul>
                <p className="mt-2 text-small text-text-secondary">
                  As categorias padrão e seus orçamentos serão restaurados.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirming(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={handleReset}
                disabled={isPending}
              >
                {isPending ? 'Resetando...' : 'Confirmar reset'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const title = 'Configurações'
  const content = <SettingsContent onClose={() => onOpenChange(false)} />

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
