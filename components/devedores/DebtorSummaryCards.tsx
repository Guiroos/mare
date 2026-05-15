import { formatCurrency } from '@/lib/utils/currency'
import { SummaryCard } from '@/components/ui/summary-card'
import { PersonWithBalance } from '@/lib/queries/debtors'
import { HandCoins, Users } from 'lucide-react'

type Props = {
  people: PersonWithBalance[]
}

export function DebtorSummaryCards({ people }: Props) {
  const totalOpen = people.reduce((acc, p) => acc + Math.max(0, p.balance), 0)
  const pendingCount = people.filter((p) => p.balance > 0).length

  return (
    <div className="grid grid-cols-2 gap-4">
      <SummaryCard
        variant="negative"
        label="Total em aberto"
        amount={formatCurrency(totalOpen)}
        icon={<HandCoins className="h-4 w-4 text-negative" />}
      />
      <SummaryCard
        variant="balance"
        label="Pessoas pendentes"
        amount={String(pendingCount)}
        icon={<Users className="h-4 w-4 text-text-secondary" />}
      />
    </div>
  )
}
