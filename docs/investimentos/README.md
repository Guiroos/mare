# Investimentos - indice de analise

Esta pasta organiza a analise da tela `app/(app)/investimentos` em arquivos menores, para que produto, design e engenharia possam revisar cada frente separadamente.

## Status em 12/05/2026

1. `P0` concluido:
   1. resgates limitados aos ultimos 6 meses;
   2. pendencia restrita ao mes corrente;
   3. hero comparando contra periodo consolidado quando o mes corrente estiver pendente.
2. `P1` concluido:
   1. cor persistida por tipo de investimento;
   2. default automatico usando o azul principal da Mare;
   3. header mobile preservando share mesmo com pendencia;
   4. empty state de resgates reaproveitando `EmptyState`;
   5. historico mensal dos tipos exibindo primeiro os 3 meses mais recentes, com expansao via `Ver mais`;
   6. tabela desktop com colunas financeiras estabilizadas e nota usando o espaco restante;
   7. microcopy da UI usando `Rentab.` / `Rentab. acum.` em vez de `Yield`.
3. `P2` concluido:
   1. grafico de evolucao simplificado, sem legenda duplicada e com area de apoio sob o patrimonio.

## Ordem sugerida de leitura

1. [01-contexto-e-escopo.md](./01-contexto-e-escopo.md)
2. [02-achados-de-comportamento.md](./02-achados-de-comportamento.md)
3. [03-achados-de-design-system.md](./03-achados-de-design-system.md)
4. [04-requisitos-e-criterios-de-aceite.md](./04-requisitos-e-criterios-de-aceite.md)
5. [05-roadmap-e-riscos.md](./05-roadmap-e-riscos.md)
6. [06-code-review-pos-implementacao.md](./06-code-review-pos-implementacao.md)

## Como usar esta documentacao

1. Use o arquivo de contexto para validar objetivo, limites e leitura da tela.
2. Use os arquivos de achados para discutir separadamente:
   1. inconsistencias de comportamento e semantica;
   2. desvios de interface e aderencia ao design system.
3. Use requisitos e criterios de aceite como base de implementacao.
4. Use roadmap e riscos para fatiar entregas e priorizar execucao.
5. Trate os arquivos de achados como diagnostico historico com status atualizado, e os requisitos como backlog residual e aceite do que ja foi implementado.
6. Use o code review pos-implementacao como backlog tecnico de ajustes finos e riscos residuais.

## Referencias principais

1. Handoff: `.ds/handoff/investimentos/README.md`
2. Tela atual: `app/(app)/investimentos/page.tsx`
3. Componentes:
   1. `components/investimentos/PatrimonyHero.tsx`
   2. `components/investimentos/InvestmentTypeCard.tsx`
   3. `components/investimentos/InvestmentTypeAccordion.tsx`
   4. `components/charts/PatrimonyChart.tsx`
