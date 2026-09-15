'use client'

import { useRouter } from 'next/navigation'
import { DeleteButton } from '@/components/ui/delete-button'
import { TripDialog } from '@/components/trips/TripDialog'
import { deleteTrip } from '@/lib/actions/trips'

type GoalOption = { id: string; name: string }

type Trip = {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
  goalId: string | null
}

export function TripDetailHeader({ trip, goals }: { trip: Trip; goals: GoalOption[] }) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-1">
      <TripDialog mode="edit" goals={goals} trip={trip} />
      <DeleteButton
        title="Excluir viagem"
        description={`Isso remove "${trip.name}" — os lançamentos vinculados continuam existindo, só deixam de estar agrupados nela.`}
        onDelete={async () => {
          await deleteTrip(trip.id)
          router.push('/viagens')
        }}
      />
    </div>
  )
}
