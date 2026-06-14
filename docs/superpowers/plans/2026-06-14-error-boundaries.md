# Error Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar `app/(app)/error.tsx` para capturar erros não tratados em qualquer rota autenticada e exibir UI de recuperação com sidebar intacta.

**Architecture:** Um único `error.tsx` no nível raiz do shell autenticado. O Next.js intercepta qualquer erro de Server Component nas sub-rotas e renderiza este componente no lugar do conteúdo da página, preservando o `layout.tsx` (sidebar + nav). Logging via `useEffect` para garantir uma única emissão por exibição.

**Tech Stack:** Next.js 14 App Router, React `useEffect`, DS Maré (`PageLayout`, `EmptyState`, `Button`)

**Spec:** `docs/superpowers/specs/2026-06-14-error-boundaries-design.md`

---

### Task 1: Criar `app/(app)/error.tsx`

**Files:**
- Create: `app/(app)/error.tsx`

- [ ] **Step 1: Criar o arquivo**

```tsx
'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageLayout } from '@/components/ui/page-layout'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <PageLayout>
      <EmptyState
        title="Algo deu errado"
        description="Ocorreu um erro inesperado. Tente novamente."
        action={
          <Button variant="secondary" onClick={reset}>
            Tentar novamente
          </Button>
        }
      />
    </PageLayout>
  )
}
```

- [ ] **Step 2: Rodar lint e typecheck**

```bash
npm run lint && npm run typecheck
```

Esperado: nenhum erro ou warning.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/error.tsx
git commit -m "feat(app): add root error boundary for authenticated routes"
```

---

### Task 2: Verificação visual em dev

**Files:**
- Modify (temporário): qualquer Server Component em `app/(app)/`, ex: `app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Iniciar o servidor de desenvolvimento**

```bash
npm run dev
```

- [ ] **Step 2: Forçar um erro no dashboard**

Abrir `app/(app)/dashboard/page.tsx` e adicionar `throw new Error('test error boundary')` no topo da função do componente, antes do return. Salvar o arquivo.

- [ ] **Step 3: Acessar o dashboard no browser**

Navegar para `http://localhost:3000/dashboard`.

Esperado em **produção mode** (`npm run build && npm start`): tela de erro com título "Algo deu errado", botão "Tentar novamente", e sidebar visível. Em **dev mode**: Next.js exibe o overlay de erro antes da UI — pressionar ESC para fechar o overlay e ver o `error.tsx` por baixo.

- [ ] **Step 4: Testar o botão "Tentar novamente"**

Clicar no botão. Esperado: Next.js tenta re-renderizar a página (`reset()` chama `router.refresh()` internamente). Como o erro ainda está lá, a UI de erro volta a aparecer — isso é o comportamento correto.

- [ ] **Step 5: Reverter o erro forçado**

Remover o `throw new Error(...)` de `dashboard/page.tsx`. Salvar. Confirmar que o dashboard volta ao normal.

- [ ] **Step 6: Fechar o servidor**

`Ctrl+C`

---

### Task 3: Fechar a tech debt

**Files:**
- Modify: `docs/tech-debt/README.md`
- Delete ou mover: `docs/tech-debt/error-boundaries-ausentes.md`

- [ ] **Step 1: Verificar como a tech debt está referenciada no README**

```bash
cat docs/tech-debt/README.md
```

- [ ] **Step 2: Remover ou marcar como resolvida**

Se o README lista as tech debts abertas, remover a entrada de `error-boundaries-ausentes`. Se o arquivo `.md` deve ser mantido por histórico, adicionar uma linha `**Status: resolvida em 2026-06-14**` ao topo.

- [ ] **Step 3: Commit**

```bash
git add docs/tech-debt/
git commit -m "docs(tech-debt): mark error-boundaries as resolved"
```
