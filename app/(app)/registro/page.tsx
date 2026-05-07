import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getRegistrationFormData } from '@/lib/actions/form-data'
import { PageHeader } from '@/components/ui/page-header'
import { RegistroPageClient } from './RegistroPageClient'

export default async function RegistroPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const formData = await getRegistrationFormData()
  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo lançamento"
        description="Registre uma transação, entrada, investimento ou resgate."
      />
      <RegistroPageClient formData={formData} />
    </div>
  )
}
