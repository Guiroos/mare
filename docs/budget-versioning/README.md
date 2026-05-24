# Budget Versioning — Índice

Esta pasta organiza o planejamento do recurso **Versionamento de Orçamento por Categoria**.

## Status em 24/05/2026

| Fase | Objetivo                                        | Status   |
| ---- | ----------------------------------------------- | -------- |
| 1    | Schema e migration                              | pendente |
| 2    | Query de resolução de orçamento                 | pendente |
| 3    | UI de edição ("aplicar a partir de qual mês?")  | pendente |
| 4    | Deprecação do `defaultBudget` legado            | pendente |

---

## Resumo do Problema

`category.defaultBudget` é um campo único sem temporalidade. Qualquer mês sem
`monthlyBudgetOverride` busca o valor atual do campo — incluindo meses passados.
Alterar o orçamento base hoje muda retroativamente todas as métricas históricas.

Com múltiplos usuários, isso deixa de ser inconveniência pessoal e vira bug de confiança.

## Solução

Substituir o campo único `defaultBudget` por uma tabela de histórico
`categoryBudgetHistory(categoryId, amount, effectiveFrom)`. A query de orçamento
resolve o valor vigente para um `referenceMonth` buscando o registro mais recente
com `effectiveFrom <= referenceMonth`. Meses passados ficam imunes a alterações futuras.

## Decisões Principais

- Direção A (history table) escolhida sobre snapshot por fechamento de mês
- `monthlyBudgetOverride` continua coexistindo — override pontual ainda faz sentido
- Migration seed: converter `defaultBudget` atual em primeiro registro da history
- UI deve expor "a partir de qual mês?" ao editar — padrão sugerido: mês seguinte

## Arquivos

| Arquivo | Conteúdo |
| ------- | -------- |
| [01-contexto.md](./01-contexto.md) | Contexto, opções avaliadas, decisão e não-objetivos |

## Referências

- Schema: `lib/db/schema.ts`
- Query de orçamento: `lib/queries/dashboard.ts`
- Override mensal: tabela `monthlyBudgetOverride`
- Categorias: `app/(app)/categorias/`
