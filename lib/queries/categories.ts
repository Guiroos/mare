import { db } from '@/lib/db';
import { categories, categoryGroups, paymentAccounts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function getCategoriesWithGroups(userId: string) {
  return db.query.categoryGroups.findMany({
    where: eq(categoryGroups.userId, userId),
    with: { categories: true },
    orderBy: [categoryGroups.name],
  });
}

export async function getPaymentAccounts(userId: string) {
  return db.query.paymentAccounts.findMany({
    where: eq(paymentAccounts.userId, userId),
    orderBy: [paymentAccounts.name],
  });
}
