# Error Boundaries — Design Spec

**Data:** 2026-06-14
**Tech debt:** `docs/tech-debt/error-boundaries-ausentes.md`

## Problema

Nenhuma rota dentro de `app/(app)/` possui `error.tsx`. Erros não tratados em Server Components exibem tela em branco em produção ou stack trace completo em desenvolvimento.

## Solução

Criar um único `app/(app)/error.tsx` no nível raiz do shell autenticado. Ele captura erros de qualquer subrota (`dashboard`, `registro`, `panorama`, etc.) sem precisar de arquivos por rota.

Rotas específicas (`dashboard`, `panorama`) não recebem `error.tsx` próprios por ora — as mensagens contextuais não agregam valor ao usuário frente à mensagem genérica, e o `layout.tsx` (sidebar, nav) permanece intacto independente do nível da boundary.

## Arquivo a criar

`app/(app)/error.tsx`

- Diretiva `'use client'` obrigatória (Next.js exige que error boundaries sejam Client Components)
- `useEffect(() => { console.error(error) }, [error])` para logar o erro uma vez ao exibir (visível nos devtools do browser e nos logs do Vercel em produção)
- UI: `PageLayout` + `EmptyState` + `Button variant="secondary"` para "Tentar novamente"
- Props recebidas do Next.js: `error: Error & { digest?: string }` e `reset: () => void`
- Sem novo componente no DS — um único arquivo não justifica extração

## UI

```
┌─────────────────────────────────────────┐
│  [sidebar]  Algo deu errado             │
│             Ocorreu um erro inesperado. │
│             Tente novamente.            │
│                                         │
│             [Tentar novamente]          │
└─────────────────────────────────────────┘
```

## Fora do escopo

- `app/(app)/loading.tsx` raiz (cada subrota já tem o seu)
- Serviço de monitoramento de erros (Sentry, etc.) — app ainda não tem volume que justifique
- `error.tsx` em rotas individuais — adiar até aparecer caso de uso concreto

## Critério de conclusão

- Arquivo criado e tipado corretamente
- `npm run lint && npm run typecheck` passando
- Verificar visualmente em dev: forçar erro em um Server Component e confirmar que a UI aparece com sidebar intacta
