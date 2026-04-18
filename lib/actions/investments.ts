'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { investmentTypes, investments, investmentWithdrawals, incomes } from '@/lib/db/schema';
import { auth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { format } from 'date-fns';

function requireUserId(session: Awaited<ReturnType<typeof auth>>) {
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) throw new Error('Não autorizado');
  return userId;
}

function toReferenceMonth(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return format(new Date(d.getFullYear(), d.getMonth(), 1), 'yyyy-MM-dd');
}

// ─── Tipos de investimento ────────────────────────────────────────────────────

export async function createInvestmentType(name: string) {
  const session = await auth();
  const userId = requireUserId(session);
  await db.insert(investmentTypes).values({ userId, name });
  revalidatePath('/investimentos');
}

export async function updateInvestmentType(id: string, name: string) {
  const session = await auth();
  const userId = requireUserId(session);
  await db
    .update(investmentTypes)
    .set({ name })
    .where(and(eq(investmentTypes.id, id), eq(investmentTypes.userId, userId)));
  revalidatePath('/investimentos');
}

export async function deleteInvestmentType(id: string) {
  const session = await auth();
  const userId = requireUserId(session);
  await db
    .delete(investmentTypes)
    .where(and(eq(investmentTypes.id, id), eq(investmentTypes.userId, userId)));
  revalidatePath('/investimentos');
}

// ─── Registros mensais ────────────────────────────────────────────────────────

export type UpsertInvestmentInput = {
  investmentTypeId: string;
  referenceMonth: string;
  amount?: string | null;
  yieldAmount?: string | null;
  notes?: string | null;
  existingId?: string;
};

export async function upsertInvestment(data: UpsertInvestmentInput) {
  const session = await auth();
  const userId = requireUserId(session);

  if (data.existingId) {
    await db
      .update(investments)
      .set({
        amount: data.amount || null,
        yieldAmount: data.yieldAmount || null,
        notes: data.notes || null,
      })
      .where(and(eq(investments.id, data.existingId), eq(investments.userId, userId)));
  } else {
    await db.insert(investments).values({
      userId,
      investmentTypeId: data.investmentTypeId,
      referenceMonth: data.referenceMonth,
      amount: data.amount || null,
      yieldAmount: data.yieldAmount || null,
      notes: data.notes || null,
    });
  }

  revalidatePath('/investimentos');
  revalidatePath('/dashboard');
}

export async function deleteInvestment(id: string) {
  const session = await auth();
  const userId = requireUserId(session);
  await db
    .delete(investments)
    .where(and(eq(investments.id, id), eq(investments.userId, userId)));
  revalidatePath('/investimentos');
  revalidatePath('/dashboard');
}

// ─── Resgates ─────────────────────────────────────────────────────────────────

export type CreateWithdrawalInput = {
  investmentTypeId: string;
  amount: string;
  date: string;
  destination: 'income' | 'transfer';
  notes?: string | null;
};

export async function createWithdrawal(data: CreateWithdrawalInput) {
  const session = await auth();
  const userId = requireUserId(session);

  let incomeId: string | null = null;

  if (data.destination === 'income') {
    const [income] = await db
      .insert(incomes)
      .values({
        userId,
        source: 'Resgate de investimento',
        amount: data.amount,
        referenceMonth: toReferenceMonth(data.date),
      })
      .returning({ id: incomes.id });
    incomeId = income.id;
  }

  await db.insert(investmentWithdrawals).values({
    userId,
    investmentTypeId: data.investmentTypeId,
    amount: data.amount,
    date: data.date,
    destination: data.destination,
    incomeId,
    notes: data.notes || null,
  });

  revalidatePath('/investimentos');
  revalidatePath('/dashboard');
}

export async function deleteWithdrawal(id: string) {
  const session = await auth();
  const userId = requireUserId(session);

  const [withdrawal] = await db.query.investmentWithdrawals.findMany({
    where: and(eq(investmentWithdrawals.id, id), eq(investmentWithdrawals.userId, userId)),
    limit: 1,
  });

  if (!withdrawal) return;

  await db
    .delete(investmentWithdrawals)
    .where(and(eq(investmentWithdrawals.id, id), eq(investmentWithdrawals.userId, userId)));

  if (withdrawal.incomeId) {
    await db
      .delete(incomes)
      .where(and(eq(incomes.id, withdrawal.incomeId), eq(incomes.userId, userId)));
  }

  revalidatePath('/investimentos');
  revalidatePath('/dashboard');
}
