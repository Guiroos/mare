'use client'

import { Plus } from 'lucide-react'
import { useRegistrationDialog } from '@/components/providers/RegistrationDialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { currentYearMonth } from '@/lib/utils/date'

export function DashboardFAB({ month, className }: { month: string; className?: string }) {
  const { open } = useRegistrationDialog()

  function handleClick() {
    if (month === currentYearMonth()) {
      open(month)
    } else {
      const [y, m] = month.split('-').map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      const pad = (n: number) => String(n).padStart(2, '0')
      open(month, `${y}-${pad(m)}-${pad(lastDay)}`)
    }
  }

  return (
    <Button
      variant="primary"
      size="sm"
      onClick={handleClick}
      className={cn('hidden gap-2 shadow-sm lg:flex', className)}
    >
      <Plus className="h-4 w-4" strokeWidth={2.5} />
      Novo lançamento
    </Button>
  )
}
