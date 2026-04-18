'use client';

import { Plus } from 'lucide-react';
import { useRegistrationDialog } from '@/components/providers/RegistrationDialog';

export function DashboardFAB({ month }: { month: string }) {
  const { open } = useRegistrationDialog();

  return (
    <button
      onClick={() => open(month)}
      className="hidden lg:flex fixed bottom-8 right-8 items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
      aria-label="Novo lançamento"
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}
