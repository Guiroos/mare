'use client'

import { Plus } from 'lucide-react'
import { useRegistrationDialog } from '@/components/providers/RegistrationDialog'
import { Button } from '@/components/ui/button'
import { currentYearMonth } from '@/lib/utils/date'

export function DashboardFAB({ month }: { month: string }) {
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
    <Button variant="outline" size="sm" onClick={handleClick} className="hidden lg:flex">
      <Plus className="h-3.5 w-3.5" />
      Nova
    </Button>
  )
}
