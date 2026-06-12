'use client'

import { useState, useTransition } from 'react'
import { Switch } from '@/components/ui/switch'
import { updateAutoRollover } from '@/lib/actions/settings'

type Props = {
  initialEnabled: boolean
}

export function AutoRolloverSwitch({ initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [isPending, startTransition] = useTransition()

  function handleChange(checked: boolean) {
    setEnabled(checked)
    startTransition(async () => {
      try {
        await updateAutoRollover(checked)
      } catch {
        setEnabled(!checked)
      }
    })
  }

  return (
    <Switch
      label="Copiar gastos fixos automaticamente no dia 1 de cada mês"
      checked={enabled}
      onChange={handleChange}
      disabled={isPending}
    />
  )
}
