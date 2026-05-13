'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Plus,
  CalendarDays,
  TrendingUp,
  Menu,
  Target,
  BarChart3,
  Tags,
  Settings,
  LogOut,
  MessageSquare,
  CreditCard,
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useRegistrationDialog } from '@/components/providers/RegistrationDialog'
import { FeedbackDialog } from '@/components/feedback/FeedbackDialog'

const primaryNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/parcelas', label: 'Parcelas', icon: CalendarDays },
  { href: '/investimentos', label: 'Investir', icon: TrendingUp },
] as const

const menuItems = [
  { href: '/metas', label: 'Metas', icon: Target },
  { href: '/panorama', label: 'Panorama Anual', icon: BarChart3 },
  { href: '/categorias', label: 'Categorias e Grupos', icon: Tags },
  { href: '/contas', label: 'Contas e Cartões', icon: CreditCard },
  { href: '/configuracao-mes', label: 'Configuração do Mês', icon: Settings },
]

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-1 px-1 py-2"
    >
      <div
        className={cn(
          'flex h-7 w-11 items-center justify-center rounded-lg transition-all duration-base',
          active ? 'bg-accent-subtle' : ''
        )}
      >
        <Icon
          className={cn(
            'h-5 w-5 transition-colors duration-base',
            active ? 'stroke-2 text-accent' : 'stroke-[1.75] text-text-tertiary'
          )}
        />
      </div>
      <span
        className={cn(
          'text-caption transition-colors duration-base',
          active ? 'font-semibold text-accent-text' : 'font-medium text-text-tertiary'
        )}
      >
        {label}
      </span>
    </Link>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const { open } = useRegistrationDialog()

  // If pathname already matches pendingHref, navigation settled — ignore pending
  const isActive = (href: string) => {
    if (pendingHref !== null && pendingHref !== pathname) return pendingHref === href
    return pathname === href || pathname.startsWith(href + '/')
  }
  const isMenuActive = menuItems.some(({ href }) => isActive(href))

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 select-none border-t border-border bg-bg-surface lg:hidden"
        style={{ height: '76px', boxShadow: '0 -4px 20px oklch(16% 0.022 230 / 0.04)' }}
      >
        <div className="flex h-full items-center justify-around px-1">
          {/* Left items */}
          {primaryNav.slice(0, 2).map(({ href, label, icon }) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={icon}
              active={isActive(href)}
              onClick={() => setPendingHref(href)}
            />
          ))}

          {/* FAB */}
          <div className="flex flex-1 items-start justify-center">
            <button
              onClick={() => open()}
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full text-white transition-transform duration-fast hover:-translate-y-0.5 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, var(--accent) 0%, oklch(45% 0.12 210) 100%)',
                boxShadow:
                  '0 8px 24px oklch(50% 0.14 230 / 0.35), 0 2px 6px oklch(50% 0.14 230 / 0.2), inset 0 1px 0 oklch(100% 0 0 / 0.2)',
              }}
              aria-label="Novo lançamento"
            >
              <Plus className="h-7 w-7 stroke-[2.5]" />
            </button>
          </div>

          {/* Right items */}
          <NavItem
            href="/investimentos"
            label="Investir"
            icon={TrendingUp}
            active={isActive('/investimentos')}
            onClick={() => setPendingHref('/investimentos')}
          />

          {/* Menu */}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex flex-1 flex-col items-center gap-1 px-1 py-2"
          >
            <div
              className={cn(
                'flex h-7 w-11 items-center justify-center rounded-lg transition-all duration-base',
                isMenuActive ? 'bg-accent-subtle' : ''
              )}
            >
              <Menu
                className={cn(
                  'h-5 w-5 stroke-[1.75] transition-colors duration-base',
                  isMenuActive ? 'text-accent' : 'text-text-tertiary'
                )}
              />
            </div>
            <span
              className={cn(
                'text-caption transition-colors duration-base',
                isMenuActive ? 'font-semibold text-accent-text' : 'font-medium text-text-tertiary'
              )}
            >
              Menu
            </span>
          </button>
        </div>
      </nav>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="bottom-0 left-[50%] top-auto w-full max-w-full translate-x-[-50%] translate-y-0 rounded-b-none rounded-t-2xl data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:max-w-full">
          <DialogHeader>
            <DialogTitle className="text-left">Menu</DialogTitle>
          </DialogHeader>
          <nav className="pb-safe grid grid-cols-2 gap-3">
            {menuItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => {
                  setPendingHref(href)
                  setMenuOpen(false)
                }}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-4 py-3 text-small font-medium transition-colors',
                  isActive(href)
                    ? 'border-accent/30 bg-accent-subtle text-accent-text'
                    : 'border-border text-text-primary hover:bg-bg-subtle'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
          </nav>
          <Button
            variant="ghost"
            onClick={() => {
              setMenuOpen(false)
              setFeedbackOpen(true)
            }}
            className="w-full justify-start gap-3 border border-border"
          >
            <MessageSquare className="h-4 w-4 shrink-0" />
            Enviar feedback
          </Button>
          <Button
            variant="ghost"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full justify-start gap-3 border border-border"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sair
          </Button>
        </DialogContent>
      </Dialog>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  )
}
