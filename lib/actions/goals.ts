'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { goals, goalContributions } from '@/lib/db/schema';
import { auth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

function requireUserId(session: Awaited<ReturnType<typeof auth>>) {
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) throw new Error('Não autorizado');
  return userId;
}

export type UpsertGoalInput = {
  name: string;
  targetAmount: string;
  targetDate?: string | null;
  investmentTypeId?: string | null;
  existingId?: string;
};

export async function upsertGoal(data: UpsertGoalInput) {
  const session = await auth();
  const userId = requireUserId(session);

  const values = {
    name: data.name.trim(),
    targetAmount: data.targetAmount,
    targetDate: data.targetDate || null,
    investmentTypeId: data.investmentTypeId || null,
  };

  if (data.existingId) {
    await db
      .update(goals)
      .set(values)
      .where(and(eq(goals.id, data.existingId), eq(goals.userId, userId)));
  } else {
    await db.insert(goals).values({ userId, ...values });
  }

  revalidatePath('/metas');
}

export async function deleteGoal(id: string) {
  const session = await auth();
  const userId = requireUserId(session);
  await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)));
  revalidatePath('/metas');
}

export type AddContributionInput = {
  goalId: string;
  amount: string;
  referenceMonth: string;
};

export async function addGoalContribution(data: AddContributionInput) {
  const session = await auth();
  const userId = requireUserId(session);
  await db.insert(goalContributions).values({
    goalId: data.goalId,
    userId,
    amount: data.amount,
    referenceMonth: data.referenceMonth,
    source: 'manual',
  });
  revalidatePath('/metas');
}

export async function deleteGoalContribution(id: string) {
  const session = await auth();
  const userId = requireUserId(session);
  await db
    .delete(goalContributions)
    .where(
      and(eq(goalContributions.id, id), eq(goalContributions.userId, userId))
    );
  revalidatePath('/metas');
}
