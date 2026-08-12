import { ThemeProvider } from '@/components/providers/ThemeProvider'

/**
 * O `ThemeProvider` vive aqui e em `(app)/layout.tsx`, não no root layout: a
 * landing é light-only e não usa nenhum provider de cliente, então mantê-los na
 * raiz mandava ~100 KB de JS para a única rota do site cujo LCP é ranqueado.
 *
 * Sem isto, `/login` ignoraria a preferência de tema — o `next-themes` é quem
 * escreve a classe `dark` no `<html>`.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}
