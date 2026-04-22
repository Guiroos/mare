'use client';

import { Plus } from 'lucide-react';
import { useRegistrationDialog } from '@/components/providers/RegistrationDialog';

export function DashboardFAB({ month }: { month: string }) {
  const { open } = useRegistrationDialog();

  return (
    <button
      onClick={() => open(month)}
      aria-label="Novo lançamento"
      className="hidden lg:flex fixed bottom-8 right-8 items-center justify-center w-14 h-14 rounded-full text-white transition-transform duration-150 hover:-translate-y-0.5 active:scale-95"
      style={{
        background: 'linear-gradient(135deg, var(--accent) 0%, oklch(45% 0.12 210) 100%)',
        boxShadow: '0 8px 24px oklch(50% 0.14 230 / 0.35), 0 2px 6px oklch(50% 0.14 230 / 0.2), inset 0 1px 0 oklch(100% 0 0 / 0.2)',
      }}
    >
      <Plus className="h-[26px] w-[26px]" strokeWidth={2.5} />
    </button>
  );
}
