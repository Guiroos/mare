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

## Status em 28/05/2026 — vencimento, imposto e arquivamento (07-vencimento-e-imposto.md)

### Fase 1 — Schema e migration: concluida

- `investmentTypes`: adicionados `maturityDate` (date, nullable) e `archived` (boolean, NOT NULL DEFAULT false).
- `investmentWithdrawals`: adicionado `taxAmount` (decimal 10,2, nullable).
- Migration `0011_motionless_rictor.sql` gerada e aplicada.
- `lib/utils/date.ts`: adicionado helper `daysUntil(dateStr)`.

### Fase 2 — Backend: concluida (28/05/2026)

- `lib/validations/investments.ts`: `maturityDate` em `investmentTypeSchema`; `taxAmount` em `withdrawalBase` (propagado para `withdrawalEditSchema`, `withdrawalSchema` e `updateWithdrawalActionSchema`).
- `lib/actions/investments.ts`: `maturityDate` em create/update de tipo; `taxAmount` em create/update de resgate; novas actions `archiveInvestmentType` (valida saldo zero) e `restoreInvestmentType`.
- `lib/queries/investments.ts`: `getInvestmentBalances` aceita `{ showArchived }`, retorna `maturityDate` e `archived`; `getInvestmentWithdrawals` retorna `taxAmount`; novas funcoes `getArchivedCount` e `getMaturityAlerts`; tipos exportados `InvestmentBalance` e `MaturityAlert`.

### Fase 3 — UI de vencimento: pendente

Badges nos cards, dialog de resgate pre-preenchido, widget no dashboard.

### Fase 4 — UI de imposto: pendente

Toggle de imposto no `WithdrawalDialog`, detalhamento na tabela de resgates.

### Fase 5 — UI de arquivamento: pendente

Visual atenuado, opcoes no `RowActions`, chip de filtro na Section.

### Fase 6 — Testes e revisao: pendente

## Status em 11/06/2026 — revisão do fluxo de destino de resgate (09-fluxo-destino-resgate.md)

Planejado. Bug identificado em produção: `destination = 'income'` aplicava
`investmentReturnCapital = total_capital` para todos os resgates, incluindo emergências
parciais, derrubando o totalIncomes do dashboard. Solução: novo valor `'reinvest'` para
o campo `destination`, com `investmentReturnCapital` calculado só nesse caso.

## Ordem sugerida de leitura

1. [01-contexto-e-escopo.md](./01-contexto-e-escopo.md)
2. [02-achados-de-comportamento.md](./02-achados-de-comportamento.md)
3. [03-achados-de-design-system.md](./03-achados-de-design-system.md)
4. [04-requisitos-e-criterios-de-aceite.md](./04-requisitos-e-criterios-de-aceite.md)
5. [05-roadmap-e-riscos.md](./05-roadmap-e-riscos.md)
6. [06-code-review-pos-implementacao.md](./06-code-review-pos-implementacao.md)
7. [07-vencimento-e-imposto.md](./07-vencimento-e-imposto.md)
8. [08-retorno-capital-panorama.md](./08-retorno-capital-panorama.md)
9. [09-fluxo-destino-resgate.md](./09-fluxo-destino-resgate.md)

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
