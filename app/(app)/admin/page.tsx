import { redirect } from 'next/navigation'
import { MessageSquare, Users } from 'lucide-react'
import { auth } from '@/lib/auth'
import { PageLayout } from '@/components/ui/page-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Section } from '@/components/ui/section'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { getAdminStats, getAllFeedbacks } from '@/lib/queries/admin'
import { FeedbackStatusSelect } from './FeedbackStatusSelect'

const CATEGORY_LABEL: Record<string, string> = {
  melhoria: 'Melhoria',
  implementacao: 'Implementação',
  outros: 'Outros',
}

const CATEGORY_VARIANT: Record<string, 'accent' | 'warning' | 'muted'> = {
  melhoria: 'accent',
  implementacao: 'warning',
  outros: 'muted',
}

const STATUS_LABEL: Record<string, string> = {
  new: 'Novo',
  read: 'Lido',
  done: 'Feito',
  dismissed: 'Ignorado',
}

const STATUS_VARIANT: Record<string, 'accent' | 'muted' | 'positive' | 'warning'> = {
  new: 'accent',
  read: 'muted',
  done: 'positive',
  dismissed: 'warning',
}

export default async function AdminPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail || session.user?.email !== adminEmail) redirect('/dashboard')

  const [stats, feedbacks] = await Promise.all([getAdminStats(), getAllFeedbacks()])

  return (
    <PageLayout>
      <PageHeader title="Admin" description="Visão geral da aplicação" />

      <Section title="Usuários">
        <Card padding="md">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-subtle">
              <Users className="h-5 w-5 text-accent-text" />
            </div>
            <div>
              <p className="text-h2 text-text-primary">{stats.totalUsers}</p>
              <p className="text-caption text-text-secondary">usuários cadastrados</p>
            </div>
          </div>
        </Card>
      </Section>

      <Section title="Feedbacks">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card padding="md">
            <p className="mb-3 text-small font-semibold text-text-secondary">Por status</p>
            <div className="flex flex-col gap-2.5">
              {['new', 'read', 'done', 'dismissed'].map((status) => (
                <div key={status} className="flex items-center justify-between">
                  <Badge variant={STATUS_VARIANT[status]} size="sm">
                    {STATUS_LABEL[status]}
                  </Badge>
                  <span className="text-body font-semibold tabular-nums text-text-primary">
                    {stats.byStatus[status] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card padding="md">
            <p className="mb-3 text-small font-semibold text-text-secondary">Por categoria</p>
            <div className="flex flex-col gap-2.5">
              {['melhoria', 'implementacao', 'outros'].map((cat) => (
                <div key={cat} className="flex items-center justify-between">
                  <Badge variant={CATEGORY_VARIANT[cat]} size="sm">
                    {CATEGORY_LABEL[cat]}
                  </Badge>
                  <span className="text-body font-semibold tabular-nums text-text-primary">
                    {stats.byCategory[cat] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Section>

      <Section
        title="Todos os feedbacks"
        action={
          <Badge variant="muted" size="sm">
            {feedbacks.length}
          </Badge>
        }
      >
        {feedbacks.length === 0 ? (
          <EmptyState
            icon={<MessageSquare />}
            title="Nenhum feedback ainda"
            description="Os feedbacks enviados pelos usuários aparecerão aqui."
            boxed
          />
        ) : (
          <div className="flex flex-col gap-2">
            {feedbacks.map((fb) => (
              <Card key={fb.id} padding="md">
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <p className="text-small text-text-primary">{fb.message}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={CATEGORY_VARIANT[fb.category]} size="sm">
                          {CATEGORY_LABEL[fb.category]}
                        </Badge>
                        {fb.page && (
                          <span className="truncate text-caption text-text-tertiary">
                            {fb.page}
                          </span>
                        )}
                      </div>
                    </div>
                    <FeedbackStatusSelect id={fb.id} currentStatus={fb.status} />
                  </div>
                  <div className="flex items-center gap-1.5 text-caption text-text-tertiary">
                    <span>{fb.user.name ?? fb.user.email ?? '—'}</span>
                    <span>·</span>
                    <span>
                      {fb.createdAt.toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </PageLayout>
  )
}
