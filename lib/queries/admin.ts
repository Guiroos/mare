import { db } from '@/lib/db'
import { feedback, users } from '@/lib/db/schema'
import { count, desc, eq } from 'drizzle-orm'
import { getDekForUser } from '@/lib/crypto/keys'
import { decryptField } from '@/lib/crypto/fields'

export async function getAdminStats() {
  const [totalUsersResult, feedbackByStatus, feedbackByCategory] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ status: feedback.status, count: count() }).from(feedback).groupBy(feedback.status),
    db
      .select({ category: feedback.category, count: count() })
      .from(feedback)
      .groupBy(feedback.category),
  ])

  return {
    totalUsers: Number(totalUsersResult[0]?.count ?? 0),
    byStatus: feedbackByStatus.reduce(
      (acc, row) => ({ ...acc, [row.status]: Number(row.count) }),
      {} as Record<string, number>
    ),
    byCategory: feedbackByCategory.reduce(
      (acc, row) => ({ ...acc, [row.category]: Number(row.count) }),
      {} as Record<string, number>
    ),
  }
}

export async function getAllFeedbacks() {
  const rows = await db
    .select({
      id: feedback.id,
      userId: feedback.userId,
      category: feedback.category,
      message: feedback.message,
      page: feedback.page,
      status: feedback.status,
      createdAt: feedback.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(feedback)
    .leftJoin(users, eq(feedback.userId, users.id))
    .orderBy(desc(feedback.createdAt))

  // Group by userId to minimize DEK lookups
  const dekMap = new Map<string, Buffer>()
  const getDecryptedMessage = async (userId: string, message: string) => {
    if (!dekMap.has(userId)) {
      dekMap.set(userId, await getDekForUser(userId))
    }
    const dek = dekMap.get(userId)!
    return decryptField(message, dek)
  }

  const decrypted = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      category: row.category,
      message: await getDecryptedMessage(row.userId, row.message),
      page: row.page,
      status: row.status,
      createdAt: row.createdAt,
      user: { name: row.userName, email: row.userEmail },
    }))
  )

  return decrypted
}
