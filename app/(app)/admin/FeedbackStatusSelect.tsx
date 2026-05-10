'use client'

import { useTransition } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils/cn'
import { updateFeedbackStatus } from '@/lib/actions/admin'

const STATUS_OPTIONS = [
  { value: 'new', label: 'Novo' },
  { value: 'read', label: 'Lido' },
  { value: 'done', label: 'Feito' },
  { value: 'dismissed', label: 'Ignorado' },
]

export function FeedbackStatusSelect({ id, currentStatus }: { id: string; currentStatus: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <Select
      value={currentStatus}
      onValueChange={(value) => {
        startTransition(async () => {
          await updateFeedbackStatus(id, value)
        })
      }}
    >
      <SelectTrigger className={cn('h-8 w-32 text-small', isPending && 'opacity-50')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map(({ value, label }) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
