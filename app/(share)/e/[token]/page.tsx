import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { getSharedDebtStatement } from '@/lib/queries/debtors'
import { shareTokenSchema } from '@/lib/validations/utils'
import { hashShareToken } from '@/lib/utils/share-token'
import { formatCurrency } from '@/lib/utils/currency'
import { SharedChargeList } from '@/components/share/SharedChargeList'
import { CopyPixButton } from '@/components/share/CopyPixButton'
import { EmptyState } from '@/components/ui/empty-state'
import { SummaryCard } from '@/components/ui/summary-card'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function SharedStatementPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Valida o formato antes de tocar no banco: string crua de URL nunca vai
  // direto para query.
  const parsed = shareTokenSchema.safeParse(token)
  if (!parsed.success) notFound()

  const statement = await getSharedDebtStatement(hashShareToken(parsed.data))
  if (!statement) notFound()

  const total = statement.charges.reduce((sum, c) => sum + c.amount, 0)

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-small text-text-tertiary">Olá, {statement.personName}</p>
        <h1 className="text-h2">
          {statement.ownerName ? `Você deve para ${statement.ownerName}` : 'Seu extrato'}
        </h1>
      </header>

      {statement.charges.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-6 w-6" />}
          title="Nada em aberto"
          description="Não há cobranças pendentes no momento."
          boxed
        />
      ) : (
        <>
          <SummaryCard variant="balance" label="Total em aberto" amount={formatCurrency(total)} />

          {statement.pixKey && <CopyPixButton pixKey={statement.pixKey} />}

          <SharedChargeList charges={statement.charges} />
        </>
      )}
    </div>
  )
}
