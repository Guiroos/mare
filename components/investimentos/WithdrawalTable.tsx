'use client'

import { SensitiveAmount } from '@/components/providers/PrivacyMode'
import { Badge } from '@/components/ui/badge'
import { DeleteButton } from '@/components/ui/delete-button'
import { WithdrawalEditButton } from '@/components/investimentos/WithdrawalEditButton'
import { deleteWithdrawal } from '@/lib/actions/investments'
import { formatDate } from '@/lib/utils/date'

type Withdrawal = {
  id: string
  investmentTypeId: string
  typeName: string
  date: string
  amount: number
  taxAmount: number | null
  destination: string
  notes: string | null
}

type InvestmentTypeOption = { id: string; name: string }

export function WithdrawalTable({
  withdrawals,
  investmentTypeOptions,
}: {
  withdrawals: Withdrawal[]
  investmentTypeOptions: InvestmentTypeOption[]
}) {
  if (withdrawals.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse">
        <thead>
          <tr className="border-b border-border bg-bg-subtle">
            <th className="px-5 py-2 text-left text-label uppercase text-text-tertiary">Tipo</th>
            <th className="px-5 py-2 text-left text-label uppercase text-text-tertiary">Data</th>
            <th className="px-5 py-2 text-right text-label uppercase text-text-tertiary">Valor</th>
            <th className="px-5 py-2 text-left text-label uppercase text-text-tertiary">Destino</th>
            <th className="px-5 py-2 text-left text-label uppercase text-text-tertiary">Notas</th>
            <th className="px-5 py-2" />
          </tr>
        </thead>
        <tbody>
          {withdrawals.map((w) => (
            <tr key={w.id} className="border-t border-border hover:bg-bg-subtle">
              <td className="px-5 py-2.5 text-small">{w.typeName}</td>
              <td className="px-5 py-2.5 text-small text-text-secondary">{formatDate(w.date)}</td>
              <td className="px-5 py-2.5 text-right">
                <span className="text-small font-semibold tabular-nums text-negative">
                  − <SensitiveAmount value={w.amount} />
                </span>
                {w.taxAmount !== null && (
                  <span className="block text-caption tabular-nums text-text-tertiary">
                    Bruto <SensitiveAmount value={w.amount + w.taxAmount} /> · IR{' '}
                    <SensitiveAmount value={w.taxAmount} />
                  </span>
                )}
              </td>
              <td className="px-5 py-2.5">
                {w.destination === 'income' ? (
                  <Badge variant="muted">Caixa</Badge>
                ) : (
                  <Badge variant="muted">Transferência</Badge>
                )}
              </td>
              <td className="max-w-32 truncate px-5 py-2.5 text-caption text-text-secondary">
                {w.notes ?? ''}
              </td>
              <td className="px-5 py-2.5">
                <div className="flex items-center gap-1">
                  <WithdrawalEditButton withdrawal={w} investmentTypes={investmentTypeOptions} />
                  <DeleteButton
                    onDelete={async () => {
                      'use server'
                      await deleteWithdrawal(w.id)
                    }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
