'use client'

import Link from 'next/link'
import { SensitiveAmount } from '@/components/providers/PrivacyMode'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { DeleteButton } from '@/components/ui/delete-button'
import { TripDialog } from '@/components/trips/TripDialog'
import { deleteTrip } from '@/lib/actions/trips'
import { formatDisplayDate } from '@/lib/utils/date'

type Trip = {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
  goalId: string | null
  goalName: string | null
  goalBalance: number | null
  totalSpent: number
}

type GoalOption = { id: string; name: string }

export function TripsList({ trips, goals }: { trips: Trip[]; goals: GoalOption[] }) {
  if (trips.length === 0) {
    return (
      <EmptyState title="Nenhuma viagem cadastrada. Crie a primeira para agrupar os gastos dela." />
    )
  }

  return (
    <div className="space-y-3">
      {trips.map((trip) => {
        const period =
          trip.startDate && trip.endDate
            ? `${formatDisplayDate(trip.startDate)} – ${formatDisplayDate(trip.endDate)}`
            : (trip.startDate ?? trip.endDate) && formatDisplayDate(trip.startDate ?? trip.endDate!)

        return (
          <div key={trip.id} className="rounded-xl border bg-bg-surface px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <Link href={`/viagens/${trip.id}`} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium hover:underline">{trip.name}</span>
                  {trip.goalName && <Badge variant="muted">{trip.goalName}</Badge>}
                </div>
                {period && <p className="mt-1 text-caption text-text-secondary">{period}</p>}
              </Link>
              <div className="flex items-center gap-1">
                <TripDialog mode="edit" goals={goals} trip={trip} />
                <DeleteButton
                  title="Excluir viagem"
                  description={`Isso remove "${trip.name}" — os lançamentos vinculados continuam existindo, só deixam de estar agrupados nela.`}
                  onDelete={async () => {
                    await deleteTrip(trip.id)
                  }}
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-text-secondary">
              <span className="tabular-nums">
                Gasto: <SensitiveAmount value={trip.totalSpent} />
              </span>
              {trip.goalBalance !== null && (
                <span className="tabular-nums">
                  Guardado: <SensitiveAmount value={trip.goalBalance} />
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
