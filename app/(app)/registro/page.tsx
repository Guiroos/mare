import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getRegistrationFormData } from '@/lib/actions/form-data';
import { TransactionForm } from '@/components/forms/TransactionForm';
import { currentYearMonth } from '@/lib/format';

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const session = await auth();
  if (!session) redirect('/login');

  const month = searchParams.month ?? currentYearMonth();
  const { categoryGroups, accounts } = await getRegistrationFormData();

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-xl font-bold">Novo lançamento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registre um gasto, entrada ou investimento.
        </p>
      </div>

      <TransactionForm
        categoryGroups={categoryGroups}
        accounts={accounts}
        defaultMonth={month}
      />
    </div>
  );
}
