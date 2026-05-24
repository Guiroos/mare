# Budget Versioning — Contexto e Decisões

## Contexto

O Maré hoje usa um campo único `category.defaultBudget` como orçamento base por categoria.
Qualquer mês que não tenha um `monthlyBudgetOverride` explícito busca esse valor diretamente.
O campo não tem temporalidade — não sabe quando foi criado nem quando foi alterado.

O problema emerge quando o usuário quer ajustar o orçamento de uma categoria a partir do
mês atual. A alteração retroage para todos os meses passados sem override, distorcendo
métricas históricas (percentual gasto vs. orçamento, comparativos mensais, panorama anual).

Enquanto o Maré era estritamente pessoal, o próprio usuário entendia o contexto da mudança.
Com beta testers e expansão planejada, retroatividade acidental é um bug de confiança.

## Opções Avaliadas

| Opção | Descrição | Descartada por |
| ----- | --------- | -------------- |
| A — History table | Nova tabela com `effectiveFrom`; query resolve valor vigente | **Escolhida** |
| B — Snapshot por fechamento | Meses "fechados" congelam o orçamento | Introduz conceito novo de produto ("fechar mês") — decisão separada |
| C — Backfill em escrita | Ao alterar `defaultBudget`, criar overrides para todos os meses passados | Inviável com múltiplos usuários: custo de escrita O(n meses × categorias) |

## Decisão Arquitetural Principal

Implementar `categoryBudgetHistory` como fonte de verdade para orçamento base.

```
categoryBudgetHistory
  id            uuid PK
  categoryId    uuid FK → categories.id
  amount        decimal(12,2)
  effectiveFrom date  -- sempre YYYY-MM-01
```

A query de orçamento para um `referenceMonth` resolve:

1. `monthlyBudgetOverride` para aquele mês — se existir, usa
2. Registro mais recente de `categoryBudgetHistory` com `effectiveFrom <= referenceMonth`
3. Fallback: `category.defaultBudget` (legado, enquanto migration não tiver rodado)

## Decisões Tomadas

| Decisão | Escolha | Motivo |
| ------- | ------- | ------ |
| `monthlyBudgetOverride` | Mantém e coexiste | Override pontual continua fazendo sentido para exceções |
| Seed da migration | Converter `defaultBudget` atual com `effectiveFrom = '2000-01-01'` | Garante que qualquer mês histórico resolva corretamente |
| `effectiveFrom` padrão na UI | Mês seguinte | Alteração retroativa deve ser opt-in consciente, não padrão |
| `defaultBudget` no schema | Manter como fallback na v1 | Permite rollback seguro; deprecar em fase posterior |

## Objetivo

Permitir que o usuário:

- altere o orçamento base de uma categoria escolhendo a partir de qual mês vigora
- tenha métricas históricas preservadas sem distorção retroativa
- continue usando override pontual para exceções de mês específico

## Não Objetivos Da Primeira Versão

- Não exibir histórico de alterações de orçamento na UI
- Não permitir definir orçamento diferente para meses futuros não contíguos
- Não migrar `monthlyBudgetOverride` para dentro da history table
- Não bloquear edição de meses passados (requer conceito de "fechar mês")
- Não notificar usuário sobre impacto da alteração em meses futuros
