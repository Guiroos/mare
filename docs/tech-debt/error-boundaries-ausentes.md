**Status: resolvida em 2026-06-14** — `app/(app)/error.tsx` criado.

---

# Error boundaries ausentes em app/(app)/

## Problema

Nenhuma rota dentro de `app/(app)/` possui `error.tsx`. Em caso de erro não tratado
em um Server Component (ex: falha de conexão com Neon, exceção em query, dado
inesperado do banco), o Next.js exibe sua página de erro padrão — em desenvolvimento
um stack trace completo, em produção uma tela em branco ou genérica.

Todas as rotas de usuário autenticado estão afetadas:
`dashboard`, `registro`, `categorias`, `configuracao-mes`, `contas`, `parcelas`,
`investimentos`, `metas`, `panorama`, `devedores`, `devedores/[id]`, `admin`.

O arquivo `app/(app)/loading.tsx` também está ausente no nível do layout raiz,
embora cada subrota tenha o seu `loading.tsx` individualmente.

## Por que não resolvemos agora

O app ainda não tem volume de usuários que justifique UI de erro polida. Em
desenvolvimento os stack traces são mais úteis.

## Solução planejada

Criar no mínimo um `error.tsx` no nível de `app/(app)/` (raiz do shell autenticado)
para capturar erros de qualquer subrota:

```tsx
// app/(app)/error.tsx
'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <PageLayout>
      <EmptyState
        title="Algo deu errado"
        description="Ocorreu um erro inesperado. Tente novamente."
        action={{ label: 'Tentar novamente', onClick: reset }}
      />
    </PageLayout>
  )
}
```

Rotas com lógica crítica (`dashboard`, `panorama`) podem ter `error.tsx` próprios
com mensagens contextuais.

## Critério para revisitar

- Antes do lançamento para mais usuários.
- Quando houver o primeiro relato de "tela em branco" em produção.
