import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getPaymentAccounts } from '@/lib/queries/categories'
import { AccountDialog } from '@/components/contas/AccountDialog'
import { DeleteButton } from '@/components/ui/delete-button'
import { deletePaymentAccount } from '@/lib/actions/categories'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Section } from '@/components/ui/section'
import { PageLayout } from '@/components/ui/page-layout'
import { PageHeader } from '@/components/ui/page-header'

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  credit: 'Crédito',
  debit: 'Débito',
  pix: 'Pix',
}

export default async function ContasPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const userId = session.user.id
  const accounts = await getPaymentAccounts(userId)

  return (
    <PageLayout>
      <PageHeader
        title="Contas e Cartões"
        description="Gerencie suas contas de débito, crédito e Pix."
      />

      <Section title="Contas e cartões" action={<AccountDialog mode="create" />}>
        {accounts.length === 0 ? (
          <EmptyState title="Nenhuma conta cadastrada." />
        ) : (
          <Card padding="none" className="divide-y">
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-small font-medium">{account.name}</span>
                  <Badge variant="muted">{ACCOUNT_TYPE_LABELS[account.type] ?? account.type}</Badge>
                  {account.closingDay && (
                    <span className="text-caption text-text-secondary">
                      Fecha dia {account.closingDay}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <AccountDialog
                    mode="edit"
                    account={{
                      id: account.id,
                      name: account.name,
                      type: account.type,
                      closingDay: account.closingDay,
                    }}
                  />
                  <DeleteButton
                    onDelete={async () => {
                      'use server'
                      await deletePaymentAccount(account.id)
                    }}
                  />
                </div>
              </div>
            ))}
          </Card>
        )}
      </Section>
    </PageLayout>
  )
}
