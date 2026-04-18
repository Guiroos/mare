import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  getActiveInstallmentGroups,
  getInstallmentTimeline,
} from '@/lib/queries/parcelas';
import { formatCurrency } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { InstallmentTimelineChart } from '@/components/charts/InstallmentTimelineChart';

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
              <div key={group.id} className="rounded-xl border bg-card px-4 py-4 space-y-3">
                {/* Name + category */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-0.5">
                    <p className="font-semibold leading-tight">{group.name}</p>
                    <p className="text-xs text-muted-foreground">{group.accountName}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {group.categoryName}
                  </Badge>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <Progress
                    value={group.paidInstallments}
                    max={group.totalInstallments}
                    className="h-1.5"
                  />
                  <p className="text-xs text-muted-foreground">
                    Parcela {group.paidInstallments} de {group.totalInstallments}
                  </p>
                </div>

                {/* Amounts */}
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  <div>
                    <p className="text-xs text-muted-foreground">por mês</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCurrency(group.installmentAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">restante</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCurrency(group.remainingAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">total</p>
                    <p className="text-sm tabular-nums text-muted-foreground">
                      {formatCurrency(group.totalAmount)}
                    </p>
                  </div>
                </div>
              </div>
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
