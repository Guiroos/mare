import { timingSafeEqual } from 'crypto'
import { eq, and, count, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { fixedExpenses, userSettings } from '@/lib/db/schema'
import { currentYearMonth, prevMonth, yearMonthToReferenceMonth } from '@/lib/utils/date'

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // sem secret configurado, nega tudo (evita `Bearer undefined`)
  const provided = Buffer.from(req.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const currentMonth = currentYearMonth()
  const referenceMonth = yearMonthToReferenceMonth(currentMonth)
  const prevReferenceMonth = yearMonthToReferenceMonth(prevMonth(currentMonth))

  const eligibleUsers = await db.query.userSettings.findMany({
    where: eq(userSettings.autoRolloverFixedExpenses, true),
    columns: { userId: true },
  })

  const results = await Promise.allSettled(
    eligibleUsers.map(({ userId }) =>
      // O lock serializa execuções sobrepostas (Vercel pode entregar o mesmo cron duas vezes):
      // a 2ª espera a 1ª commitar, vê o mês povoado e pula.
      db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${userId} || ${referenceMonth}))`
        )

        const [existing] = await tx
          .select({ total: count() })
          .from(fixedExpenses)
          .where(
            and(eq(fixedExpenses.userId, userId), eq(fixedExpenses.referenceMonth, referenceMonth))
          )

        if (existing.total > 0) return { userId, skipped: true }

        const prevExpenses = await tx
          .select()
          .from(fixedExpenses)
          .where(
            and(
              eq(fixedExpenses.userId, userId),
              eq(fixedExpenses.referenceMonth, prevReferenceMonth)
            )
          )

        if (prevExpenses.length === 0) return { userId, copied: 0 }

        await tx.insert(fixedExpenses).values(
          prevExpenses.map((e) => ({
            userId,
            name: e.name,
            amount: e.amount,
            dueDay: e.dueDay,
            categoryId: e.categoryId,
            accountId: e.accountId,
            referenceMonth,
            paid: false,
          }))
        )

        return { userId, copied: prevExpenses.length }
      })
    )
  )

  const summary = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    console.error('[cron rollover]', eligibleUsers[i].userId, r.reason)
    return { userId: eligibleUsers[i].userId, error: String(r.reason) }
  })
  const failed = results.some((r) => r.status === 'rejected')
  return Response.json(
    { ok: !failed, referenceMonth, results: summary },
    { status: failed ? 500 : 200 }
  )
}
