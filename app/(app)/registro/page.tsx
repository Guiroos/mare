import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getRegistrationFormData } from '@/lib/actions/form-data'
import { TransactionForm } from '@/components/forms/TransactionForm'
import { currentYearMonth } from '@/lib/utils/date'

export default async function RegistroPage({ searchParams }: { searchParams: { month?: string } }) {
  const session = await auth()
  if (!session) redirect('/login')

  const month = searchParams.month ?? currentYearMonth()
  const { categoryGroups, accounts, investmentTypes } = await getRegistrationFormData()

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-xl font-bold">Novo lançamento</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Registre um gasto, entrada ou investimento.
        </p>
      </div>

      <TransactionForm
        categoryGroups={categoryGroups}
        accounts={accounts}
        investmentTypes={investmentTypes}
        defaultMonth={month}
      />
    </div>
  )
}
