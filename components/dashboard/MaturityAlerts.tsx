'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils/currency'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { WithdrawalDialog } from '@/components/investimentos/WithdrawalDialog'
import { DEFAULT_INVESTMENT_TYPE_BG_COLOR, DEFAULT_INVESTMENT_TYPE_COLOR } from '@/lib/utils/color'

function typeInitials(name: string) {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return name.slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

type Alert = {
  id: string
  name: string
  color: string | null
  bgColor: string | null
  maturityDate: string
  currentBalance: number
  daysUntil: number
}

function MaturityBadge({ days }: { days: number }) {
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

function AlertRow({
  alert,
  investmentTypes,
}: {
  alert: Alert
  investmentTypes: { id: string; name: string }[]
}) {
  const [open, setOpen] = useState(false)
  const bg = alert.bgColor ?? DEFAULT_INVESTMENT_TYPE_BG_COLOR
  const fg = alert.color ?? DEFAULT_INVESTMENT_TYPE_COLOR

  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
      {/* Avatar */}
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-small font-semibold"
        style={{ background: bg, color: fg }}
      >
        {typeInitials(alert.name)}
      </div>

      {/* Name + badge */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium text-text-primary">{alert.name}</p>
        <div className="mt-0.5">
          <MaturityBadge days={alert.daysUntil} />
        </div>
      </div>

      {/* Balance */}
      <span className="flex-shrink-0 text-small font-semibold tabular-nums text-text-primary">
        {formatCurrency(alert.currentBalance)}
      </span>

      {/* Withdraw button */}
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Resgatar
      </Button>

      <WithdrawalDialog
        investmentTypes={investmentTypes}
        initialTypeId={alert.id}
        initialAmount={alert.currentBalance}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  )
}

type Props = {
  alerts: Alert[]
  investmentTypes: { id: string; name: string }[]
}

export function MaturityAlerts({ alerts, investmentTypes }: Props) {
  if (alerts.length === 0) return null

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-bg-surface shadow-sm">
      {alerts.map((alert) => (
        <AlertRow key={alert.id} alert={alert} investmentTypes={investmentTypes} />
      ))}
    </div>
  )
}
