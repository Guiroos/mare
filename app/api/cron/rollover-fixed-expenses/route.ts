import { timingSafeEqual } from 'crypto'
import { eq, and, count } from 'drizzle-orm'
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
    eligibleUsers.map(async ({ userId }) => {
      const [existing] = await db
        .select({ total: count() })
        .from(fixedExpenses)
        .where(
          and(eq(fixedExpenses.userId, userId), eq(fixedExpenses.referenceMonth, referenceMonth))
        )

      if (existing.total > 0) return { userId, skipped: true }

      const prevExpenses = await db.query.fixedExpenses.findMany({
        where: and(
          eq(fixedExpenses.userId, userId),
          eq(fixedExpenses.referenceMonth, prevReferenceMonth)
        ),
      })

      if (prevExpenses.length === 0) return { userId, copied: 0 }

      await db.insert(fixedExpenses).values(
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

  const summary = results.map((r) => (r.status === 'fulfilled' ? r.value : { error: r.reason }))
  return Response.json({ ok: true, referenceMonth, results: summary })
}
