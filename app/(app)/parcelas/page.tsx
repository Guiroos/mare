import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  getActiveInstallmentGroups,
  getInstallmentTimeline,
} from '@/lib/queries/parcelas';
import { InstallmentTimelineChart } from '@/components/charts/InstallmentTimelineChart';
import { InstallmentGroupCard } from '@/components/parcelas/InstallmentGroupCard';

export default async function ParcelasPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const userId = (session.user as any).id as string;

  const [groups, timeline] = await Promise.all([
    getActiveInstallmentGroups(userId),
    getInstallmentTimeline(userId),
  ]);

  return (
    <div className="space-y-8 max-w-3xl">
      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold">Parcelas Futuras</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhe suas compras parceladas e os compromissos por mês.
        </p>
      </div>

      {/* ─── Parcelas ativas ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Parcelas ativas
        </h2>

        {groups.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhuma parcela ativa.
          </div>
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
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Compromissos por mês
        </h2>
        <div className="rounded-xl border bg-card px-4 py-4">
          <InstallmentTimelineChart data={timeline} />
        </div>
      </div>
    </div>
  );
}
