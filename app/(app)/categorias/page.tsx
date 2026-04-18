import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getCategoriesWithGroups, getPaymentAccounts } from '@/lib/queries/categories';
import { formatCurrency } from '@/lib/format';
import { GroupDialog } from '@/components/categorias/GroupDialog';
import { CategoryDialog } from '@/components/categorias/CategoryDialog';
import { AccountDialog } from '@/components/categorias/AccountDialog';
import { DeleteButton } from '@/components/categorias/DeleteButton';
import { ReorderButtons } from '@/components/categorias/ReorderButtons';
import {
  deleteCategoryGroup,
  deleteCategory,
  deletePaymentAccount,
} from '@/lib/actions/categories';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default async function CategoriasPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const userId = (session.user as any).id as string;
  const [groups, accounts] = await Promise.all([
    getCategoriesWithGroups(userId),
    getPaymentAccounts(userId),
  ]);

  const groupOptions = groups.map((g) => ({ id: g.id, name: g.name }));
  const groupIds = groups.map((g) => g.id);

  const ACCOUNT_TYPE_LABELS: Record<string, string> = {
    credit: 'Crédito',
    debit: 'Débito',
    pix: 'Pix',
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold">Categorias e grupos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie grupos, categorias e contas de pagamento.
        </p>
      </div>

      {/* ─── Grupos e Categorias ─────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Grupos e categorias
          </h2>
          <GroupDialog mode="create" />
        </div>

        {groups.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum grupo criado. Comece criando um grupo.
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => {
              const totalBudget = group.categories.reduce(
                (sum, cat) => sum + Number(cat.defaultBudget ?? 0),
                0
              );

              return (
                <div key={group.id} className="rounded-xl border bg-card">
                  {/* Header do grupo */}
                  <div className="flex items-center gap-2 px-4 py-3">
                    <ReorderButtons groupId={group.id} allGroupIds={groupIds} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{group.name}</span>
                        <div className="flex items-center gap-2">
                          {totalBudget > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {formatCurrency(totalBudget)}/mês
                            </span>
                          )}
                          <GroupDialog
                            mode="edit"
                            group={{ id: group.id, name: group.name }}
                          />
                          <DeleteButton
                            onDelete={async () => {
                              'use server';
                              await deleteCategoryGroup(group.id);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Categorias */}
                  {group.categories.length > 0 && (
                    <div className="border-t divide-y">
                      {group.categories.map((cat) => (
                        <div
                          key={cat.id}
                          className="flex items-center justify-between px-4 py-2.5"
                        >
                          <span className="text-sm">{cat.name}</span>
                          <div className="flex items-center gap-2">
                            {cat.defaultBudget ? (
                              <span className="text-xs text-muted-foreground">
                                {formatCurrency(Number(cat.defaultBudget))}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/50">
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
                              }}
                            />
                            <DeleteButton
                              onDelete={async () => {
                                'use server';
                                await deleteCategory(cat.id);
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Botão adicionar categoria */}
                  <div className="px-4 py-2 border-t">
                    <CategoryDialog
                      mode="create"
                      groups={groupOptions}
                      defaultGroupId={group.id}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Separator />

      {/* ─── Contas e Cartões ────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Contas e cartões
          </h2>
          <AccountDialog mode="create" />
        </div>

        {accounts.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhuma conta cadastrada.
          </div>
        ) : (
          <div className="rounded-xl border bg-card divide-y">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{account.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {ACCOUNT_TYPE_LABELS[account.type] ?? account.type}
                  </Badge>
                  {account.closingDay && (
                    <span className="text-xs text-muted-foreground">
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
                      'use server';
                      await deletePaymentAccount(account.id);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
