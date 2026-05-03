import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getCategoriesWithGroups, getPaymentAccounts } from '@/lib/queries/categories'
import { formatCurrency } from '@/lib/utils/currency'
import { GroupDialog } from '@/components/categorias/GroupDialog'
import { CategoryDialog } from '@/components/categorias/CategoryDialog'
import { AccountDialog } from '@/components/categorias/AccountDialog'
import { DeleteButton } from '@/components/ui/delete-button'
import { ReorderButtons } from '@/components/categorias/ReorderButtons'
import { deleteCategoryGroup, deleteCategory, deletePaymentAccount } from '@/lib/actions/categories'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Separator } from '@/components/ui/separator'
import { PageLayout } from '@/components/ui/page-layout'
import { PageHeader } from '@/components/ui/page-header'

export default async function CategoriasPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const userId = (session.user as { id: string }).id
  const [groups, accounts] = await Promise.all([
    getCategoriesWithGroups(userId),
    getPaymentAccounts(userId),
  ])

  const groupOptions = groups.map((g) => ({ id: g.id, name: g.name }))
  const groupIds = groups.map((g) => g.id)

  const ACCOUNT_TYPE_LABELS: Record<string, string> = {
    credit: 'Crédito',
    debit: 'Débito',
    pix: 'Pix',
  }

  return (
    <PageLayout>
      <PageHeader
        title="Categorias e grupos"
        description="Gerencie grupos, categorias e contas de pagamento."
      />

      {/* ─── Grupos e Categorias ─────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Grupos e categorias
          </h2>
          <GroupDialog mode="create" />
        </div>

        {groups.length === 0 ? (
          <EmptyState title="Nenhum grupo criado. Comece criando um grupo." />
        ) : (
          <div className="space-y-3">
            {groups.map((group) => {
              const totalBudget = group.categories.reduce(
                (sum, cat) => sum + Number(cat.defaultBudget ?? 0),
                0
              )

              return (
                <div key={group.id} className="rounded-xl border bg-bg-surface">
                  {/* Header do grupo */}
                  <div className="flex items-center gap-2 px-4 py-3">
                    <ReorderButtons groupId={group.id} allGroupIds={groupIds} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{group.name}</span>
                        <div className="flex items-center gap-2">
                          {totalBudget > 0 && (
                            <span className="text-xs text-text-secondary">
                              {formatCurrency(totalBudget)}/mês
                            </span>
                          )}
                          <GroupDialog mode="edit" group={{ id: group.id, name: group.name }} />
                          <DeleteButton
                            onDelete={async () => {
                              'use server'
                              await deleteCategoryGroup(group.id)
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Categorias */}
                  {group.categories.length > 0 && (
                    <div className="divide-y border-t">
                      {group.categories.map((cat) => (
                        <div key={cat.id} className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-sm">{cat.name}</span>
                          <div className="flex items-center gap-2">
                            {cat.defaultBudget ? (
                              <span className="text-xs text-text-secondary">
                                {formatCurrency(Number(cat.defaultBudget))}
                              </span>
                            ) : (
                              <span className="text-text-secondary/50 text-xs">sem orçamento</span>
                            )}
                            <CategoryDialog
                              mode="edit"
                              groups={groupOptions}
                              category={{
                                id: cat.id,
                                name: cat.name,
                                groupId: group.id,
                                defaultBudget: cat.defaultBudget,
                                color: cat.color,
                              }}
                            />
                            <DeleteButton
                              onDelete={async () => {
                                'use server'
                                await deleteCategory(cat.id)
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Botão adicionar categoria */}
                  <div className="border-t px-4 py-2">
                    <CategoryDialog mode="create" groups={groupOptions} defaultGroupId={group.id} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Separator />

      {/* ─── Contas e Cartões ────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Contas e cartões
          </h2>
          <AccountDialog mode="create" />
        </div>

        {accounts.length === 0 ? (
          <EmptyState title="Nenhuma conta cadastrada." />
        ) : (
          <div className="divide-y rounded-xl border bg-bg-surface">
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{account.name}</span>
                  <Badge variant="muted">{ACCOUNT_TYPE_LABELS[account.type] ?? account.type}</Badge>
                  {account.closingDay && (
                    <span className="text-xs text-text-secondary">
                      Fecha dia {account.closingDay}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-0.5">
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
          </div>
        )}
      </div>
    </PageLayout>
  )
}
