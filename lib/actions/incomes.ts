'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { incomes } from '@/lib/db/schema';
import { auth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

function requireUserId(session: Awaited<ReturnType<typeof auth>>) {
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) throw new Error('Não autorizado');
  return userId;
}

export type CreateIncomeInput = {
  source: string;
  amount: string;
  referenceMonth: string;
};

export async function createIncome(data: CreateIncomeInput) {
  const session = await auth();
  const userId = requireUserId(session);

  await db.insert(incomes).values({
    userId,
    source: data.source,
    amount: data.amount,
    referenceMonth: data.referenceMonth,
  });

  revalidatePath('/dashboard');
}

export type UpdateIncomeInput = {
  id: string;
  source: string;
  amount: string;
};

export async function updateIncome(data: UpdateIncomeInput) {
  const session = await auth();
  const userId = requireUserId(session);

  await db
    .update(incomes)
    .set({ source: data.source, amount: data.amount })
    .where(and(eq(incomes.id, data.id), eq(incomes.userId, userId)));

  revalidatePath('/dashboard');
}

export async function deleteIncome(id: string) {
  const session = await auth();
  const userId = requireUserId(session);

  await db
    .delete(incomes)
    .where(and(eq(incomes.id, id), eq(incomes.userId, userId)));

  revalidatePath('/dashboard');
}
