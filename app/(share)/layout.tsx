/**
 * Shell da página pública de extrato. Não pode viver em `(app)` — aquele layout
 * chama `auth()` e monta Sidebar/BottomNav — nem em `(marketing)`, que força
 * `.theme-light` e traz o footer da landing.
 *
 * Sem providers: quem abre isso vem de um link no WhatsApp, uma vez, no celular.
 */
export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary antialiased">
      <main className="mx-auto w-full max-w-lg px-4 py-8">{children}</main>
    </div>
  )
}
