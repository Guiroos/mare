'use client'

import { useState, useTransition } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { copyFixedExpensesFromPrevMonth } from '@/lib/actions/transactions'

type Props = {
  referenceMonth: string
  prevReferenceMonth: string
}

export function CopyFixedExpensesButton({ referenceMonth, prevReferenceMonth }: Props) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState('')

  const handleCopy = () => {
    setMessage('')
    startTransition(async () => {
      try {
        const result = await copyFixedExpensesFromPrevMonth(referenceMonth, prevReferenceMonth)
        if (result.copied === 0) {
          setMessage('Nenhum gasto fixo no mês anterior.')
        } else {
          setMessage(`${result.copied} gasto(s) copiado(s).`)
        }
      } catch (err) {
        setMessage('Erro ao copiar. Tente novamente.')
        console.error(err)
      }
    })
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={isPending}
        onClick={handleCopy}
      >
        <Copy className="h-3.5 w-3.5" />
        {isPending ? 'Copiando...' : 'Copiar do mês anterior'}
      </Button>
      {message && <span className="text-xs text-text-secondary">{message}</span>}
    </div>
  )
}
