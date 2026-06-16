// app/(app)/historico/page.tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { PageLayout } from '@/components/ui/page-layout'
import { parseHistoricoParams } from '@/lib/utils/historico-params'
import { getHistoricoFeed } from '@/lib/queries/historico'
import { db } from '@/lib/db'
import { categoryGroups, paymentAccounts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { HistoricoFilters } from './HistoricoFilters'
import { HistoricoClient } from './HistoricoClient'

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await auth()
  if (!session) redirect('/login')
  const userId = session.user.id

  const rawParams = await searchParams
  const params = parseHistoricoParams(rawParams)

  const [feedResult, groupsData, accountsData] = await Promise.all([
    getHistoricoFeed(userId, params),
    db.query.categoryGroups.findMany({
      where: eq(categoryGroups.userId, userId),
      with: { categories: true },
    }),
    db.query.paymentAccounts.findMany({
      where: eq(paymentAccounts.userId, userId),
    }),
  ])

  const categoryOptions = groupsData.flatMap((g) =>
    g.categories.map((c) => ({ value: c.id, label: c.name }))
  )
  const accountOptions = accountsData.map((a) => ({ value: a.id, label: a.name }))

  return (
    <PageLayout>
      <PageHeader title="Histórico" description="Todas as movimentações" />
      <HistoricoFilters
        params={params}
        categoryOptions={categoryOptions}
        accountOptions={accountOptions}
      />
      <HistoricoClient
        key={`${params.de}_${params.ate}_${params.tipos.join(',')}_${params.categorias.join(',')}_${params.contas.join(',')}_${params.q}`}
        initialItems={feedResult.items}
        initialHasMore={feedResult.hasMore}
        initialNextCursor={feedResult.nextCursor}
        params={params}
      />
    </PageLayout>
  )
}
