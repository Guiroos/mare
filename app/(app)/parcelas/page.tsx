import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getActiveInstallmentGroups, getInstallmentTimeline } from '@/lib/queries/parcelas'
import { InstallmentTimelineChart } from '@/components/charts/InstallmentTimelineChart'
import { InstallmentGroupCard } from '@/components/parcelas/InstallmentGroupCard'
import { EmptyState } from '@/components/ui/empty-state'

export default async function ParcelasPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const userId = (session.user as { id: string }).id

  const [groups, timeline] = await Promise.all([
    getActiveInstallmentGroups(userId),
    getInstallmentTimeline(userId),
  ])

  return (
    <div className="max-w-3xl space-y-8">
      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold">Parcelas Futuras</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe suas compras parceladas e os compromissos por mês.
        </p>
      </div>

      {/* ─── Parcelas ativas ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Parcelas ativas
        </h2>

        {groups.length === 0 ? (
          <EmptyState title="Nenhuma parcela ativa." />
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <InstallmentGroupCard key={group.id} group={group} />
            ))}
          </div>
        )}
      </div>

      {/* ─── Compromissos por mês ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Compromissos por mês
        </h2>
        <div className="rounded-xl border bg-card px-4 py-4">
          <InstallmentTimelineChart data={timeline} />
        </div>
      </div>
    </div>
  )
}
