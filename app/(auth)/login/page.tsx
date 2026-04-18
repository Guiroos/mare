import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { LoginButton } from '@/components/auth/LoginButton';
import { Waves } from 'lucide-react';

export default async function LoginPage() {
  const session = await auth();

  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm px-6 space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10">
            <Waves className="h-7 w-7 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Maré</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Controle financeiro pessoal
            </p>
          </div>
        </div>

        <LoginButton />
      </div>
    </div>
  );
}
