'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Download, RotateCcw, Trash2, TriangleAlert } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Segment, SegmentOption } from '@/components/ui/segment'
import { useMediaQuery } from '@/hooks/use-media-query'
import { resetAccount } from '@/lib/actions/reset-account'
import { deleteAccount } from '@/lib/actions/delete-account'
import { usePrivacyMode } from '@/components/providers/PrivacyMode'
import { Switch } from '@/components/ui/switch'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userEmail?: string | null
}

const THEME_OPTIONS: SegmentOption[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
  { value: 'system', label: 'Sistema' },
]

function SettingsContent({
  onClose,
  userEmail,
}: {
  onClose: () => void
  userEmail?: string | null
}) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { isPrivate, toggle } = usePrivacyMode()
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isDeletePending, startDeleteTransition] = useTransition()
  const [emailConfirm, setEmailConfirm] = useState('')

  const emailMatches =
    !!userEmail && emailConfirm.trim().toLowerCase() === userEmail.trim().toLowerCase()

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

  function handleDelete() {
    startDeleteTransition(async () => {
      try {
        const result = await deleteAccount(emailConfirm)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
      } catch {
        toast.error('Erro ao excluir a conta. Tente novamente.')
        return
      }

      // Fora do try acima de propósito: a exclusão é irreversível e já
      // aconteceu. Se o signOut falhar (ele faz requisições de rede), dizer
      // "erro ao excluir" mandaria o usuário repetir uma operação que deu
      // certo — e o retry responderia "Conta não encontrada.".
      // A sessão é JWT: o cookie precisa ser derrubado. A action já o limpa no
      // servidor; o signOut aqui também limpa o estado do next-auth no cliente.
      try {
        await signOut({ callbackUrl: '/' })
      } catch {
        toast.success('Conta excluída. Redirecionando...')
        router.push('/')
        router.refresh()
      }
    })
  }

  function cancelDelete() {
    setDeleting(false)
    setEmailConfirm('')
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
        <p className="mb-1 text-small font-semibold text-text-primary">Privacidade</p>
        <p className="mb-3 text-small text-text-secondary">
          Oculta valores monetários nas páginas financeiras.
        </p>
        <Switch label="Modo privado" checked={isPrivate} onChange={toggle} />
      </div>

      {/* Antes da Zona de perigo de propósito: quem está prestes a resetar ou
          excluir a conta encontra a saída de dados antes do botão vermelho. */}
      <div>
        <p className="mb-1 text-small font-semibold text-text-primary">Seus dados</p>
        <p className="mb-3 text-small text-text-secondary">
          Baixa tudo o que está na sua conta — lançamentos, categorias, contas, parcelas,
          investimentos, metas e devedores. Sem filtro de período.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href="/api/export/completo" download>
              <Download className="h-4 w-4" />
              Excel (.xlsx)
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/api/export/completo?format=csv" download>
              <Download className="h-4 w-4" />
              CSV (.zip)
            </a>
          </Button>
        </div>
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

      {/* Sem o e-mail da sessão (o tipo permite null) não há como confirmar a
          exclusão: o botão ficaria desabilitado para sempre, sem nada na tela
          explicando por quê. Melhor não oferecer a ação. */}
      {userEmail && (
        <div>
          <p className="mb-1 text-small font-semibold text-text-primary">Excluir conta</p>
          <p className="mb-4 text-small text-text-secondary">
            Remove sua conta e tudo o que há nela. Diferente do reset, aqui não sobra nada — nem o
            acesso ao app.
          </p>
          <Button
            variant="danger"
            onClick={() => setDeleting(true)}
            disabled={deleting}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Excluir conta
          </Button>

          {deleting && (
            <div className="mt-4 space-y-3 rounded-lg border border-negative bg-bg-subtle p-4">
              <div className="flex gap-2">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-negative" />
                <div>
                  <p className="text-small font-semibold text-negative">
                    Ação irreversível e definitiva
                  </p>
                  <p className="mt-1 text-small text-text-secondary">
                    Além de todos os seus dados financeiros, serão apagados:
                  </p>
                  <ul className="mt-2 space-y-0.5 text-small text-text-secondary">
                    <li>· Seu acesso ao app</li>
                    <li>· Categorias, grupos e orçamentos</li>
                    <li>· Links de extrato que você compartilhou</li>
                    <li>· Feedbacks que você enviou</li>
                  </ul>
                  <p className="mt-2 text-small text-text-secondary">
                    Se quiser voltar depois, será preciso criar uma conta do zero — nada é
                    recuperado.
                  </p>
                </div>
              </div>

              {/* O e-mail fica no hint, não no placeholder: repetido dentro do
                  campo (ainda mais com autofill) o gate de digitação vira um
                  toque, e ele é a única trava do hard delete. */}
              <Field label="Digite seu e-mail para confirmar" hint={userEmail}>
                <Input
                  type="email"
                  autoComplete="off"
                  value={emailConfirm}
                  onChange={(e) => setEmailConfirm(e.target.value)}
                  disabled={isDeletePending}
                />
              </Field>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={cancelDelete}
                  disabled={isDeletePending}
                >
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={handleDelete}
                  disabled={isDeletePending || !emailMatches}
                >
                  {isDeletePending ? 'Excluindo...' : 'Excluir conta'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function SettingsDialog({ open, onOpenChange, userEmail }: SettingsDialogProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const title = 'Configurações'
  const content = <SettingsContent onClose={() => onOpenChange(false)} userEmail={userEmail} />

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
