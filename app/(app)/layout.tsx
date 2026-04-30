import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { RegistrationDialogProvider } from '@/components/providers/RegistrationDialog'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  return (
    <RegistrationDialogProvider>
      <div className="min-h-screen bg-bg-base">
        <Sidebar user={{ name: session.user?.name, email: session.user?.email }} />
        <main className="pb-[76px] lg:pb-0 lg:pl-60">
          <div className="px-4 py-6 lg:px-8 lg:py-7">{children}</div>
        </main>
        <BottomNav />
      </div>
    </RegistrationDialogProvider>
  )
}
