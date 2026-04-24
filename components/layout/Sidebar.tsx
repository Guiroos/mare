'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  PlusCircle,
  CalendarDays,
  TrendingUp,
  Target,
  BarChart3,
  Tags,
  Settings,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const mainNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/registro', label: 'Registro', icon: PlusCircle },
  { href: '/parcelas', label: 'Parcelas Futuras', icon: CalendarDays },
  { href: '/investimentos', label: 'Investimentos', icon: TrendingUp },
  { href: '/metas', label: 'Metas', icon: Target },
  { href: '/panorama', label: 'Panorama Anual', icon: BarChart3 },
]

const configNav = [
  { href: '/categorias', label: 'Categorias e Grupos', icon: Tags },
  { href: '/configuracao-mes', label: 'Configuração do Mês', icon: Settings },
]

interface SidebarProps {
  user?: { name?: string | null; email?: string | null }
}

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
    <Link
      href={href}
      className={cn(
        'duration-[120ms] relative flex items-center gap-[11px] rounded-md px-3 py-[9px] text-[13.5px] font-medium transition-all',
        active
          ? 'bg-accent-subtle font-semibold text-accent-text'
          : 'text-text-secondary hover:bg-bg-subtle hover:text-text-primary'
      )}
    >
      {active && (
        <span className="absolute -left-[10px] bottom-2 top-2 w-[3px] rounded-r-sm bg-accent" />
      )}
      <Icon className={cn('h-[17px] w-[17px] shrink-0', active ? 'stroke-2' : 'stroke-[1.75]')} />
      {label}
    </Link>
  )
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?'

  return (
    <aside className="hidden lg:fixed lg:bottom-0 lg:left-0 lg:top-0 lg:flex lg:min-h-screen lg:w-60 lg:flex-col lg:border-r lg:border-border lg:bg-bg-surface">
      {/* Logo */}
      <div className="flex items-center gap-[10px] border-b border-border px-5 py-[22px]">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
          style={{
            background: 'linear-gradient(135deg, var(--accent) 0%, oklch(45% 0.12 210) 100%)',
            boxShadow: '0 2px 8px oklch(50% 0.14 230 / 0.28), inset 0 1px 0 oklch(100% 0 0 / 0.2)',
          }}
        >
          <svg width="18" height="13" viewBox="0 0 42 30" fill="none">
            <path
              d="M3 18 C8 10, 14 6, 21 14 C28 22, 34 18, 39 8"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M3 25 C9 18, 15 15, 21 19 C27 23, 33 22, 39 16"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.5"
            />
          </svg>
        </div>
        <span className="text-[18px] font-semibold tracking-tight text-text-primary">
          Mar<em className="font-[500] text-accent">é</em>
        </span>
      </div>

      {/* Principal */}
      <p className="px-[22px] pb-2 pt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
        Principal
      </p>
      <nav className="flex flex-col gap-[2px] overflow-visible px-[10px]">
        {mainNav.map(({ href, label, icon }) => (
          <NavItem key={href} href={href} label={label} icon={icon} active={isActive(href)} />
        ))}
      </nav>

      <div className="mx-[14px] my-[10px] h-px bg-border" />

      {/* Configuração */}
      <p className="px-[22px] pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
        Configuração
      </p>
      <nav className="flex flex-col gap-[2px] overflow-visible px-[10px]">
        {configNav.map(({ href, label, icon }) => (
          <NavItem key={href} href={href} label={label} icon={icon} active={isActive(href)} />
        ))}
      </nav>

      {/* User footer */}
      <div className="mt-auto border-t border-border p-[14px]">
        <div className="flex cursor-pointer items-center gap-[10px] rounded-[10px] p-2 transition-colors hover:bg-bg-subtle">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
            style={{
              background: 'linear-gradient(135deg, oklch(70% 0.1 180), oklch(55% 0.12 210))',
            }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-text-primary">
              {user?.name ?? '—'}
            </div>
            <div className="truncate text-[11px] text-text-tertiary">{user?.email ?? ''}</div>
          </div>
          <ChevronRight className="h-[14px] w-[14px] shrink-0 text-text-tertiary" />
        </div>
      </div>
    </aside>
  )
}
