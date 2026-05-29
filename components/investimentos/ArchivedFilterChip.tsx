'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Chip } from '@/components/ui/chip'

type Props = {
  count: number
  active: boolean
}

export function ArchivedFilterChip({ count, active }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  if (count === 0 && !active) return null

  const handleClick = () => {
    if (active) {
      router.push(pathname)
    } else {
      router.push(`${pathname}?archived=1`)
    }
  }

  return (
    <Chip active={active} onClick={handleClick}>
      Arquivados
    </Chip>
  )
}
