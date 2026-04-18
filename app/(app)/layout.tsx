import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { BottomNav } from '@/components/layout/BottomNav';
import { RegistrationDialogProvider } from '@/components/providers/RegistrationDialog';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return (
    <RegistrationDialogProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="lg:pl-60 pb-16 lg:pb-0">
          <div className="mx-auto max-w-4xl px-4 py-6">
            {children}
          </div>
        </main>
        <BottomNav />
      </div>
    </RegistrationDialogProvider>
  );
}
