'use server';

import { auth } from '@/lib/auth';
import { getCategoriesWithGroups, getPaymentAccounts } from '@/lib/queries/categories';
import { getInvestmentTypes } from '@/lib/queries/investments';

function requireUserId(session: Awaited<ReturnType<typeof auth>>) {
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) throw new Error('Não autorizado');
  return userId;
}

export async function getRegistrationFormData() {
  const session = await auth();
  const userId = requireUserId(session);

  const [categoryGroups, accounts, investmentTypes] = await Promise.all([
    getCategoriesWithGroups(userId),
    getPaymentAccounts(userId),
    getInvestmentTypes(userId),
  ]);

  return { categoryGroups, accounts, investmentTypes };
}
