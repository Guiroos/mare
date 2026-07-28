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
import { PrivacyToggle } from '@/components/providers/PrivacyMode'
import { ExportButton } from '@/components/export/ExportButton'

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

  const exportQuery = new URLSearchParams({
    de: params.de,
    ate: params.ate,
    tipos: params.tipos.join(','),
  })
  if (params.categorias.length > 0) exportQuery.set('categorias', params.categorias.join(','))
  if (params.contas.length > 0) exportQuery.set('contas', params.contas.join(','))
  if (params.q) exportQuery.set('q', params.q)

  return (
    <PageLayout>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Histórico" description="Todas as movimentações" />
        <div className="flex flex-shrink-0 items-center gap-2">
          <ExportButton href={`/api/export/extrato?${exportQuery.toString()}`} />
          <PrivacyToggle />
        </div>
      </div>
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
