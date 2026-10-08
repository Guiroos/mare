# Devedores — Índice

> **Estado atual (2026-10-08).** Esta pasta é o planejamento da v1 (maio/2026). Desde então entraram conciliação de pagamento (ajuste negativo), quitação por cobrança (`08-quitacao-por-cobranca.md`), edição de lançamentos, divisão de gasto (split) e link público de extrato (`/e/[token]`). As regras **vigentes** estão em `.claude/domain.md` › Devedores; onde este texto divergir de lá, lá vale.

Esta pasta organiza o planejamento e execução do módulo `devedores`.

## Status em 14/05/2026

| Fase | Objetivo                      | Status    |
| ---- | ----------------------------- | --------- |
| 1    | Banco e tipos                 | concluída |
| 2    | Validações, queries e actions | concluída |
| 3    | Página e cadastro de pessoas  | concluída |
| 4    | Cobranças manuais             | concluída |
| 5    | Pagamentos                    | concluída |
| 6    | Vínculo com transações        | concluída |
| 7    | Ajustes e exclusão segura     | concluída |

**Fluxo principal completo.** Há pendências deferidas e backlog documentado abaixo.

---

## Pendências Deferidas (sem UI, aguardam caso de uso)

| Item | Onde está documentado | Por quê foi adiado |
| ---- | --------------------- | ------------------ |
| Vencimento de cobrança (`dueDate`) | `02-modelo-de-dados.md`, `03-ux-e-formularios.md` | Campo reservado; card de "valores vencidos" só entra quando o campo for usado na prática |

## Limitações Conhecidas (by design, aceitas na v1)

| Limitação | Detalhe | Referência |
| --------- | ------- | ---------- |
| Exclusão de `income` fora de devedores não avisa | Se o usuário deletar a entrada em `/registro` ou dashboard, o `payment` fica com `incomeId = null` sem notificação; saldo do devedor não é afetado | `04-backend.md` — comportamento de `incomeId` nulo |

## Backlog Pós-v1

| Item | Detalhe | Referência |
| ---- | ------- | ---------- |
| Ação "Atribuir a devedor" em `/registro` | Atalho para criar cobrança a partir da lista de transações existentes, sem abrir devedores | `03-ux-e-formularios.md` Fase Posterior Opcional |

## Arquivos

| Arquivo                                       | Conteúdo                                                     |
| --------------------------------------------- | ------------------------------------------------------------ |
| [01-contexto.md](./01-contexto.md)            | Contexto, decisão arquitetural, objetivos e não-objetivos    |
| [02-modelo-de-dados.md](./02-modelo-de-dados.md) | Tabelas, campos, semântica dos tipos e cálculo de saldo   |
| [03-ux-e-formularios.md](./03-ux-e-formularios.md) | Rota, telas, formulários e padrões de componentes       |
| [04-backend.md](./04-backend.md)              | Validações, queries e actions com regras de segurança        |
| [05-roadmap.md](./05-roadmap.md)              | Fases com checklists, critérios de aceite e questões abertas |
| [06-planejamento-detalhe-pessoa.md](./06-planejamento-detalhe-pessoa.md) | Planejamento da evolução da tela `/devedores/[id]` (implementado) |
| [08-quitacao-por-cobranca.md](./08-quitacao-por-cobranca.md) | Quitação de cobranças por pagamento (`settledByPaymentId`) |

## Referências

- Lista: `app/(app)/devedores/page.tsx`
- Detalhe: `app/(app)/devedores/[id]/page.tsx`
- Schema: `lib/db/schema.ts`
- Ownership: `lib/auth/ownership.ts`
- Spec original: [00-techspec.md](./00-techspec.md)
