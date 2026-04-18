'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Plus, CalendarDays, TrendingUp, Menu, Target, BarChart3, Tags, Settings } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRegistrationDialog } from '@/components/providers/RegistrationDialog';

const menuItems = [
  { href: '/metas', label: 'Metas', icon: Target },
  { href: '/panorama', label: 'Panorama Anual', icon: BarChart3 },
  { href: '/categorias', label: 'Categorias e Grupos', icon: Tags },
  { href: '/configuracao-mes', label: 'Configuração do Mês', icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { open } = useRegistrationDialog();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card">
        <div className="flex items-center justify-around h-16">
          <Link
            href="/dashboard"
            className={cn(
              'flex flex-col items-center gap-1 px-4 py-2 text-xs transition-colors',
              isActive('/dashboard') ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span>Dashboard</span>
          </Link>

          <Link
            href="/parcelas"
            className={cn(
              'flex flex-col items-center gap-1 px-4 py-2 text-xs transition-colors',
              isActive('/parcelas') ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <CalendarDays className="h-5 w-5" />
            <span>Parcelas</span>
          </Link>

          <button
            onClick={() => open()}
            className="flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg -mt-5 transition-transform active:scale-95"
            aria-label="Novo lançamento"
          >
            <Plus className="h-6 w-6" />
          </button>

          <Link
            href="/investimentos"
            className={cn(
              'flex flex-col items-center gap-1 px-4 py-2 text-xs transition-colors',
              isActive('/investimentos') ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <TrendingUp className="h-5 w-5" />
            <span>Investimentos</span>
          </Link>

          <button
            onClick={() => setMenuOpen(true)}
            className="flex flex-col items-center gap-1 px-4 py-2 text-xs text-muted-foreground transition-colors"
          >
            <Menu className="h-5 w-5" />
            <span>Menu</span>
          </button>
        </div>
      </nav>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="bottom-0 top-auto translate-y-0 translate-x-[-50%] left-[50%] rounded-t-2xl rounded-b-none max-w-full w-full sm:max-w-full data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom">
          <DialogHeader>
            <DialogTitle className="text-left">Menu</DialogTitle>
          </DialogHeader>
          <nav className="grid grid-cols-2 gap-3 pb-safe">
            {menuItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium transition-colors',
                  isActive(href)
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border text-foreground hover:bg-bg-subtle'
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
  );
}
