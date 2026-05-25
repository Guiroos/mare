'use client'

import { useState, useTransition } from 'react'
import { Section } from '@/components/ui/section'
import { Switch } from '@/components/ui/switch'
import { Field } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { inputBase, inputErrorCls } from '@/components/ui/input'
import { updateCreditMode } from '@/lib/actions/fatura'
import { currentYearMonth } from '@/lib/utils/date'

type Props = {
  initialCreditMode: 'accrual' | 'fatura'
  initialFaturaActiveFrom: string | null
  hasCreditAccounts: boolean
}

export function CreditModeSection({
  initialCreditMode,
  initialFaturaActiveFrom,
  hasCreditAccounts,
}: Props) {
  const [isFatura, setIsFatura] = useState(initialCreditMode === 'fatura')
  const [activeFrom, setActiveFrom] = useState(
    initialFaturaActiveFrom ? initialFaturaActiveFrom.slice(0, 7) : ''
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleToggle(checked: boolean) {
    setIsFatura(checked)
    setError(null)
    if (!checked) setActiveFrom('')
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      try {
        await updateCreditMode({
          creditMode: isFatura ? 'fatura' : 'accrual',
          faturaActiveFrom: isFatura ? activeFrom : undefined,
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao salvar configuração.')
      }
    })
  }

  const isDirty =
    (isFatura ? 'fatura' : 'accrual') !== initialCreditMode ||
    (isFatura ? activeFrom : '') !== (initialFaturaActiveFrom?.slice(0, 7) ?? '')

  return (
    <Section title="Regime de fatura">
      <div className="flex flex-col gap-4">
        {!hasCreditAccounts && (
          <p className="text-small text-warning">
            Nenhum cartão de crédito com data de fechamento cadastrada. Configure um cartão em
            &quot;Contas e cartões&quot; para usar o regime de fatura.
          </p>
        )}

        <Switch
          label="Ativar regime de fatura"
          checked={isFatura}
          onChange={handleToggle}
          disabled={!hasCreditAccounts}
        />

        {isFatura && (
          <Field
            label="Ativar a partir de"
            hint="Meses anteriores mantêm o comportamento atual."
            error={error && !activeFrom ? 'Selecione o mês de ativação.' : undefined}
          >
            <input
              type="month"
              value={activeFrom}
              min={currentYearMonth()}
              onChange={(e) => setActiveFrom(e.target.value)}
              className={[inputBase, error && !activeFrom ? inputErrorCls : '']
                .filter(Boolean)
                .join(' ')}
            />
          </Field>
        )}

        {error && <p className="text-small text-negative">{error}</p>}

        <div className="flex justify-end">
          <Button
            variant="primary"
            size="md"
            onClick={handleSave}
            disabled={!isDirty || isPending || (isFatura && !activeFrom)}
          >
            {isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>
    </Section>
  )
}
