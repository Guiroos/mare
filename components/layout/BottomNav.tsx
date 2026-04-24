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
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useRegistrationDialog } from '@/components/providers/RegistrationDialog'

const primaryNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/parcelas', label: 'Parcelas', icon: CalendarDays },
  { href: '/investimentos', label: 'Investir', icon: TrendingUp },
] as const

const menuItems = [
  { href: '/metas', label: 'Metas', icon: Target },
  { href: '/panorama', label: 'Panorama Anual', icon: BarChart3 },
  { href: '/categorias', label: 'Categorias e Grupos', icon: Tags },
  { href: '/configuracao-mes', label: 'Configuração do Mês', icon: Settings },
]

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
}) {
  return (
    <Link href={href} className="flex flex-1 flex-col items-center gap-[3px] px-1 py-2">
      <div
        className={cn(
          'duration-[160ms] flex h-7 w-11 items-center justify-center rounded-[14px] transition-all',
          active ? 'bg-accent-subtle' : ''
        )}
      >
        <Icon
          className={cn(
            'duration-[160ms] h-5 w-5 transition-colors',
            active ? 'stroke-2 text-accent' : 'stroke-[1.75] text-text-tertiary'
          )}
        />
      </div>
      <span
        className={cn(
          'duration-[160ms] text-[10.5px] tracking-[-0.005em] transition-colors',
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
  const { open } = useRegistrationDialog()

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const isMenuActive = menuItems.some(({ href }) => isActive(href))

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-bg-surface lg:hidden"
        style={{ height: '76px', boxShadow: '0 -4px 20px oklch(16% 0.022 230 / 0.04)' }}
      >
        <div className="flex h-full items-center justify-around px-1">
          {/* Left items */}
          {primaryNav.slice(0, 2).map(({ href, label, icon }) => (
            <NavItem key={href} href={href} label={label} icon={icon} active={isActive(href)} />
          ))}

          {/* FAB */}
          <div className="flex flex-1 items-start justify-center">
            <button
              onClick={() => open()}
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full text-white transition-transform duration-150 hover:-translate-y-0.5 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, var(--accent) 0%, oklch(45% 0.12 210) 100%)',
                boxShadow:
                  '0 8px 24px oklch(50% 0.14 230 / 0.35), 0 2px 6px oklch(50% 0.14 230 / 0.2), inset 0 1px 0 oklch(100% 0 0 / 0.2)',
              }}
              aria-label="Novo lançamento"
            >
              <Plus className="h-[26px] w-[26px] stroke-[2.5]" />
            </button>
          </div>

          {/* Right items */}
          <NavItem
            href="/investimentos"
            label="Investir"
            icon={TrendingUp}
            active={isActive('/investimentos')}
          />

          {/* Menu */}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex flex-1 flex-col items-center gap-[3px] px-1 py-2"
          >
            <div
              className={cn(
                'duration-[160ms] flex h-7 w-11 items-center justify-center rounded-[14px] transition-all',
                isMenuActive ? 'bg-accent-subtle' : ''
              )}
            >
              <Menu
                className={cn(
                  'duration-[160ms] h-5 w-5 stroke-[1.75] transition-colors',
                  isMenuActive ? 'text-accent' : 'text-text-tertiary'
                )}
              />
            </div>
            <span
              className={cn(
                'duration-[160ms] text-[10.5px] tracking-[-0.005em] transition-colors',
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
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-colors',
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
        </DialogContent>
      </Dialog>
    </>
  )
}
