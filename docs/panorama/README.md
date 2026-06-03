# Panorama — índice de documentação

Esta pasta organiza análises e specs da tela `app/(app)/panorama`.

## Arquivos

1. [01-bugs-calculo-anual.md](./01-bugs-calculo-anual.md) — dois bugs de lógica
   identificados em junho/2026: saldo divergente entre tabela e card hero, e distorção
   de melhor/pior mês por ciclo de reinvestimento.

## Dependências

- `docs/investimentos/08-retorno-capital-panorama.md` — problema raiz que alimenta os
  bugs documentados aqui. Ler antes deste índice.

## Referências

- Tela: `app/(app)/panorama/page.tsx`
- Componentes: `components/panorama/AnnualSummaryCards.tsx`,
  `components/charts/PatrimonyEvolutionChart.tsx`
- Query: `lib/queries/panorama.ts`
