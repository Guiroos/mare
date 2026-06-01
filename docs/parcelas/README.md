# Parcelas — Correção de Datas e ReferenceMonth

Esta pasta documenta o planejamento e execução da melhoria no fluxo de criação de compras parceladas.

## Problema Central

O comportamento atual replica a data exata da compra para todas as parcelas futuras (`addMonths(purchaseDate, i)`), e calcula o `referenceMonth` como `startOfMonth(date)` sem considerar o `closingDay` da conta. Isso gera dois bugs:

1. **Data incorreta nas parcelas 2+** — a data "17/06" numa parcela de junho é artificial; a compra não aconteceu nesse dia.
2. **`referenceMonth` errado na parcela 1** — se a compra foi no dia 18 e o `closingDay = 16`, a parcela pertence à fatura do mês seguinte, não do mês atual.

## Status em 01/06/2026

| Fase | Objetivo | Status |
| ---- | -------- | ------ |
| 1 | Correção da action `createInstallmentPurchase` | pendente |
| 2 | Script de migração de parcelas futuras existentes | pendente |
| 3 | Testes unitários e de integração | pendente |

## Arquivos

| Arquivo | Conteúdo |
| ------- | -------- |
| [01-contexto-e-problema.md](./01-contexto-e-problema.md) | Análise do problema, cenários e algoritmo correto |
| [02-plano-de-implementacao.md](./02-plano-de-implementacao.md) | Fases, checklists e critérios de aceite |

## Referências

- Action: `lib/actions/transactions.ts` — `createInstallmentPurchase`
- Schema: `lib/db/schema.ts` — `transactions`, `installmentGroups`, `paymentAccounts`
- Utilitários de data: `lib/utils/date.ts`
- Script de migração (a criar): `scripts/fix-installment-dates.ts`
