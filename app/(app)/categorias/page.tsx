import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getCategoriesWithGroups } from '@/lib/queries/categories'
import { formatCurrency } from '@/lib/utils/currency'
import { GroupDialog } from '@/components/categorias/GroupDialog'
import { CategoryDialog } from '@/components/categorias/CategoryDialog'
import { DeleteButton } from '@/components/ui/delete-button'
import { ReorderButtons } from '@/components/categorias/ReorderButtons'
import { deleteCategoryGroup, deleteCategory } from '@/lib/actions/categories'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Section } from '@/components/ui/section'
import { PageLayout } from '@/components/ui/page-layout'
import { PageHeader } from '@/components/ui/page-header'

export default async function CategoriasPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const userId = session.user.id
  const groups = await getCategoriesWithGroups(userId)

  const groupOptions = groups.map((g) => ({ id: g.id, name: g.name }))
  const groupIds = groups.map((g) => g.id)

  return (
    <PageLayout>
      <PageHeader
        title="Categorias e grupos"
        description="Gerencie grupos e categorias de gastos."
      />

      <Section title="Grupos e categorias" action={<GroupDialog mode="create" />}>
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
                <Card key={group.id} padding="none">
                  {/* Header do grupo */}
                  <div className="flex items-center gap-2 px-4 py-3">
                    <ReorderButtons groupId={group.id} allGroupIds={groupIds} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-body font-medium">{group.name}</span>
                        <div className="flex items-center gap-2">
                          {totalBudget > 0 && (
                            <span className="text-caption tabular-nums text-text-secondary">
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
                          <span className="text-small">{cat.name}</span>
                          <div className="flex items-center gap-2">
                            {cat.defaultBudget ? (
                              <span className="text-caption tabular-nums text-text-secondary">
                                {formatCurrency(Number(cat.defaultBudget))}
                              </span>
                            ) : (
                              <span className="text-caption text-text-secondary opacity-50">
                                sem orçamento
                              </span>
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
                </Card>
              )
            })}
          </div>
        )}
      </Section>
    </PageLayout>
  )
}
