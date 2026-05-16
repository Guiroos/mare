'use client'

import { useRouter } from 'next/navigation'
import { Chip } from '@/components/ui/chip'

interface YearSelectorProps {
  years: number[]
  selected: number
}

export function YearSelector({ years, selected }: YearSelectorProps) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-1.5">
      {years.map((year) => (
        <Chip
          key={year}
          active={year === selected}
          onClick={() => router.push(`/panorama?year=${year}`)}
        >
          {year}
        </Chip>
      ))}
    </div>
  )
}
