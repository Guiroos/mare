'use client'

import { Combobox } from '@/components/ui/combobox'
import { Field } from '@/components/ui/field'

export type TripOption = {
  id: string
  name: string
}

type Props = {
  trips: TripOption[]
  tripId: string
  onTripChange: (id: string) => void
  error?: string
}

export function TripPicker({ trips, tripId, onTripChange, error }: Props) {
  return (
    <Field label="Viagem" hint="Opcional" error={error}>
      <Combobox
        options={trips.map((t) => ({ value: t.id, label: t.name }))}
        value={tripId}
        onValueChange={onTripChange}
        placeholder="Buscar viagem..."
        error={!!error}
      />
    </Field>
  )
}
