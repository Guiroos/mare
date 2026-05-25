# Regime de Fatura — Índice

Esta pasta organiza o planejamento e execução do recurso **Regime de Fatura**.

## Status em 24/05/2026

| Fase | Objetivo                          | Status     |
| ---- | --------------------------------- | ---------- |
| 1    | Schema e configuração             | concluída  |
| 2    | Queries de estado de fatura       | concluída  |
| 3    | Cards de fatura no dashboard      | concluída  |
| 4    | Fluxo de pagamento de fatura      | concluída  |
| 5    | Bifurcação das queries de despesa | concluída  |
| 6    | Polish e edge cases               | em progresso |

---

## Resumo do Problema

O modelo atual trata gastos no crédito como despesa no mês da compra (modelo competência).
Para usuários que pagam a fatura com o recebimento do mês seguinte, o dashboard aparece
inflado com despesas que ainda não saíram do caixa — o saldo não reflete a realidade
percebida por esses usuários.

## Solução

Configuração opt-in por usuário: **regime de fatura**. Quando ativo, despesas de crédito
só entram no saldo quando a fatura é registrada como paga. Compras e gastos fixos no
crédito continuam armazenados e visíveis, mas entram no caixa pelo pagamento da fatura.
Um card no dashboard por conta de crédito exibe o acúmulo do ciclo atual e alerta quando
há fatura vencida sem pagamento registrado.

## Decisões Principais

- Configuração por usuário (não por cartão)
- Sem pagamento parcial na v1
- Ativação com "a partir de mês X" para não afetar histórico
- Alteração de regime bloqueada após registrar pagamento de fatura
- Usuários sem regime ativo: zero impacto

## Arquivos

| Arquivo | Conteúdo |
| ------- | -------- |
| [01-contexto.md](./01-contexto.md) | Contexto, decisões arquiteturais, objetivos e não-objetivos |
| [02-modelo-de-dados.md](./02-modelo-de-dados.md) | Tabelas, campos, semântica e lógica de cálculo |
| [03-ux-e-formularios.md](./03-ux-e-formularios.md) | Fluxos, estados dos cards e formulário de pagamento |
| [04-backend.md](./04-backend.md) | Validações, queries, actions e edge cases |
| [05-roadmap.md](./05-roadmap.md) | Fases com checklists, critérios de aceite e backlog |

## Referências

- Schema: `lib/db/schema.ts`
- Utilitário de ciclo: `lib/utils/date.ts` — `billingCycleDateRange`
- Dashboard: `app/(app)/dashboard/page.tsx`
- Configurações: `app/(app)/contas/page.tsx` — `CreditModeSection`
- Ownership: `lib/auth/ownership.ts`
