import { Badge } from '@/components/ui/badge'
import { daysUntil } from '@/lib/utils/date'

export const INITIAL_MONTH_LIMIT = 3

export function typeInitials(name: string) {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return name.slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export type Entry = {
  id: string
  referenceMonth: string
  amount: number | null
  yieldAmount: number | null
  notes: string | null
  excludeFromCashFlow: boolean
}

export type Balance = {
  id: string
  name: string
  color: string | null
  bgColor: string | null
  maturityDate: string | null
  archived: boolean
  totalAmount: number
  totalYield: number
  totalWithdrawn: number
  currentBalance: number
  pendingYield: boolean
  pendingReferenceMonth: string | null
  entries: Entry[]
}

export function MaturityBadge({
  maturityDate,
  currentBalance,
}: {
  maturityDate: string | null
  currentBalance: number
}) {
  if (!maturityDate) return null
  const days = daysUntil(maturityDate)
  if (days > 30) return null
  if (days < 0 && currentBalance <= 0) return null

  if (days < 0) {
    const abs = Math.abs(days)
    return (
      <Badge variant="negative">
        Vencido há {abs} {abs === 1 ? 'dia' : 'dias'}
      </Badge>
    )
  }
  if (days === 0) return <Badge variant="warning">Vence hoje</Badge>
  return (
    <Badge variant="warning">
      Vence em {days} {days === 1 ? 'dia' : 'dias'}
    </Badge>
  )
}
