# Devedores — Índice

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
| Ajuste manual de saldo (`adjustment`) | `05-roadmap.md` Fase 7, `04-backend.md` Validações | Nenhum caso de uso concreto identificado na v1; tipo existe no banco para uso futuro |
| Vencimento de cobrança (`dueDate`) | `02-modelo-de-dados.md`, `03-ux-e-formularios.md` | Campo reservado; card de "valores vencidos" só entra quando o campo for usado na prática |

## Limitações Conhecidas (by design, aceitas na v1)

| Limitação | Detalhe | Referência |
| --------- | ------- | ---------- |
| Cobranças vinculadas a transação não podem ser excluídas | `DebtEntryList` não exibe botão de exclusão para `charge` com `sourceTransactionId`; não há ação de desvínculo | `04-backend.md` edge cases |
| Exclusão de `income` fora de devedores não avisa | Se o usuário deletar a entrada em `/registro` ou dashboard, o `payment` fica com `incomeId = null` sem notificação; saldo do devedor não é afetado | `04-backend.md` — comportamento de `incomeId` nulo |

## Backlog Pós-v1

| Item | Detalhe | Referência |
| ---- | ------- | ---------- |
| Dashboard completa de `/devedores/[id]` | Resumo financeiro, evolução do saldo, histórico agrupado e filtros | `06-planejamento-detalhe-pessoa.md` |
| Ação "Atribuir a devedor" em `/registro` | Atalho para criar cobrança a partir da lista de transações existentes, sem abrir devedores | `03-ux-e-formularios.md` Fase Posterior Opcional |

## Arquivos

| Arquivo                                       | Conteúdo                                                     |
| --------------------------------------------- | ------------------------------------------------------------ |
| [01-contexto.md](./01-contexto.md)            | Contexto, decisão arquitetural, objetivos e não-objetivos    |
| [02-modelo-de-dados.md](./02-modelo-de-dados.md) | Tabelas, campos, semântica dos tipos e cálculo de saldo   |
| [03-ux-e-formularios.md](./03-ux-e-formularios.md) | Rota, telas, formulários e padrões de componentes       |
| [04-backend.md](./04-backend.md)              | Validações, queries e actions com regras de segurança        |
| [05-roadmap.md](./05-roadmap.md)              | Fases com checklists, critérios de aceite e questões abertas |
| [06-planejamento-detalhe-pessoa.md](./06-planejamento-detalhe-pessoa.md) | Planejamento da evolução da tela `/devedores/[id]` |

## Referências

- Lista: `app/(app)/devedores/page.tsx`
- Detalhe: `app/(app)/devedores/[id]/page.tsx`
- Schema: `lib/db/schema.ts`
- Ownership: `lib/auth/ownership.ts`
- Spec original: [00-techspec.md](./00-techspec.md)
