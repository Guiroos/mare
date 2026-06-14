'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  ReceiptText,
  CalendarDays,
  TrendingUp,
  Target,
  BarChart3,
  Tags,
  Settings,
  LogOut,
  MessageSquare,
  CreditCard,
  ShieldCheck,
  HandCoins,
} from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils/cn'
import { FeedbackDialog } from '@/components/feedback/FeedbackDialog'
import { SettingsDialog } from '@/components/settings/SettingsDialog'

const mainNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/registro', label: 'Lançamento', icon: ReceiptText },
  { href: '/parcelas', label: 'Parcelas Futuras', icon: CalendarDays },
  { href: '/investimentos', label: 'Investimentos', icon: TrendingUp },
  { href: '/metas', label: 'Metas', icon: Target },
  { href: '/panorama', label: 'Panorama Anual', icon: BarChart3 },
  { href: '/devedores', label: 'Devedores', icon: HandCoins },
]

const configNav = [
  { href: '/categorias', label: 'Categorias e Grupos', icon: Tags },
  { href: '/contas', label: 'Contas e Cartões', icon: CreditCard },
  { href: '/configuracao-mes', label: 'Configuração do Mês', icon: Settings },
]

interface SidebarProps {
  user?: { name?: string | null; email?: string | null }
  isAdmin?: boolean
}

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
  onClick: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-3 rounded-md px-3 py-2 text-small font-medium transition-all duration-fast',
        active
          ? 'bg-accent-subtle font-semibold text-accent-text'
          : 'text-text-secondary hover:bg-bg-subtle hover:text-text-primary'
      )}
    >
      {active && <span className="absolute -left-2.5 bottom-2 top-2 w-1 rounded-r-sm bg-accent" />}
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'stroke-2' : 'stroke-1')} />
      {label}
    </Link>
  )
}

export function Sidebar({ user, isAdmin }: SidebarProps) {
  const pathname = usePathname()
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // If pathname already matches pendingHref, navigation settled — ignore pending
  const isActive = (href: string) => {
    if (pendingHref !== null && pendingHref !== pathname) return pendingHref === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?'

  return (
    <aside className="hidden select-none lg:fixed lg:bottom-0 lg:left-0 lg:top-0 lg:flex lg:min-h-screen lg:w-60 lg:flex-col lg:border-r lg:border-border lg:bg-bg-surface">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-5">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
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
        <span className="text-h3 text-text-primary">
          Mar<em className="font-[500] text-accent">é</em>
        </span>
      </div>

      {/* Principal */}
      <p className="px-5 pb-2 pt-4 text-label uppercase text-text-tertiary">Principal</p>
      <nav className="flex flex-col gap-0.5 overflow-visible px-2.5">
        {mainNav.map(({ href, label, icon }) => (
          <NavItem
            key={href}
            href={href}
            label={label}
            icon={icon}
            active={isActive(href)}
            onClick={() => setPendingHref(href)}
          />
        ))}
      </nav>

      <div className="mx-4 my-2.5 h-px bg-border" />

      {/* Configuração */}
      <p className="px-5 pb-2 text-label uppercase text-text-tertiary">Configuração</p>
      <nav className="flex flex-col gap-0.5 overflow-visible px-2.5">
        {configNav.map(({ href, label, icon }) => (
          <NavItem
            key={href}
            href={href}
            label={label}
            icon={icon}
            active={isActive(href)}
            onClick={() => setPendingHref(href)}
          />
        ))}
        {isAdmin && (
          <NavItem
            href="/admin"
            label="Admin"
            icon={ShieldCheck}
            active={isActive('/admin')}
            onClick={() => setPendingHref('/admin')}
          />
        )}
      </nav>

      {/* User footer */}
      <div className="mt-auto border-t border-border p-3">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex w-full cursor-pointer items-center gap-2.5 rounded-md p-2 transition-colors hover:bg-bg-subtle">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-caption font-semibold text-white"
                style={{
                  background: 'linear-gradient(135deg, oklch(70% 0.1 180), oklch(55% 0.12 210))',
                }}
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-small font-semibold text-text-primary">
                  {user?.name ?? '—'}
                </div>
                <div className="truncate text-caption text-text-tertiary">{user?.email ?? ''}</div>
              </div>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              side="top"
              align="start"
              sideOffset={4}
              className="z-50 min-w-48 overflow-hidden rounded-md border border-border bg-bg-surface shadow-md"
            >
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-small text-text-primary outline-none transition-colors hover:bg-bg-subtle focus:bg-bg-subtle"
                onSelect={(e) => {
                  e.preventDefault()
                  setFeedbackOpen(true)
                }}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                Enviar feedback
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-small text-text-primary outline-none transition-colors hover:bg-bg-subtle focus:bg-bg-subtle"
                onSelect={(e) => {
                  e.preventDefault()
                  setSettingsOpen(true)
                }}
              >
                <Settings className="h-4 w-4 shrink-0" />
                Configurações
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-small text-text-primary outline-none transition-colors hover:bg-bg-subtle focus:bg-bg-subtle"
                onSelect={() => signOut({ callbackUrl: '/login' })}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Sair
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </aside>
  )
}
