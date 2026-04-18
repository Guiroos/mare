'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  PlusCircle,
  CalendarDays,
  TrendingUp,
  Target,
  BarChart3,
  Tags,
  Settings,
  Waves,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/registro', label: 'Registro', icon: PlusCircle },
  { href: '/parcelas', label: 'Parcelas Futuras', icon: CalendarDays },
  { href: '/investimentos', label: 'Investimentos', icon: TrendingUp },
  { href: '/metas', label: 'Metas', icon: Target },
  { href: '/panorama', label: 'Panorama Anual', icon: BarChart3 },
  { href: '/categorias', label: 'Categorias e Grupos', icon: Tags },
  { href: '/configuracao-mes', label: 'Configuração do Mês', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:min-h-screen lg:border-r lg:border-border lg:bg-card lg:fixed lg:left-0 lg:top-0 lg:bottom-0">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-border">
        <Waves className="h-5 w-5 text-primary" />
        <span className="font-semibold text-lg tracking-tight">Maré</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname === href || pathname.startsWith(href + '/')
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
