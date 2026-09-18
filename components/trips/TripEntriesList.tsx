import { SensitiveAmount } from '@/components/providers/PrivacyMode'
import { TxList, TxItem } from '@/components/ui/tx-list'
import { EmptyState } from '@/components/ui/empty-state'
import { Section } from '@/components/ui/section'
import { formatDisplayDate, formatMonthName, referenceMonthToYearMonth } from '@/lib/utils/date'

type TripTransaction = {
  id: string
  name: string
  amount: number
  date: string
  categoryName: string | null
}

type TripIncome = {
  id: string
  source: string
  amount: number
  referenceMonth: string
  fromWithdrawal: boolean
}

function IncomeSection({ title, incomes }: { title: string; incomes: TripIncome[] }) {
  if (incomes.length === 0) return null
  return (
    <Section title={title}>
      <TxList>
        {incomes.map((i) => (
          <TxItem
            key={i.id}
            name={i.source}
            meta={formatMonthName(referenceMonthToYearMonth(i.referenceMonth))}
            amount={
              <>
                + <SensitiveAmount value={i.amount} />
              </>
            }
            amountTone="pos"
          />
        ))}
      </TxList>
    </Section>
  )
}

export function TripEntriesList({
  transactions,
  incomes,
}: {
  transactions: TripTransaction[]
  incomes: TripIncome[]
}) {
  if (transactions.length === 0 && incomes.length === 0) {
    return (
      <EmptyState title="Nenhum lançamento vinculado ainda. Vincule uma viagem ao editar um gasto ou entrada." />
    )
  }

  return (
    <div className="space-y-6">
      {transactions.length > 0 && (
        <Section title="Gastos">
          <TxList>
            {transactions.map((t) => (
              <TxItem
                key={t.id}
                name={t.name}
                meta={
                  <>
                    {t.categoryName ?? 'Sem categoria'} · {formatDisplayDate(t.date)}
                  </>
                }
                amount={
                  <>
                    − <SensitiveAmount value={t.amount} />
                  </>
                }
                amountTone="neg"
              />
            ))}
          </TxList>
        </Section>
      )}

      <IncomeSection title="Resgates" incomes={incomes.filter((i) => i.fromWithdrawal)} />
      <IncomeSection title="Entradas" incomes={incomes.filter((i) => !i.fromWithdrawal)} />
    </div>
  )
}
