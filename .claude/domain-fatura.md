# Domínio — Regime de Fatura

Referenciado por `CLAUDE.md` via `@`. Cobre toda a lógica de cartão de crédito no modo fatura.

---

## Conceitos fundamentais

- `userSettings.creditMode`: `'accrual'` | `'fatura'`; `faturaActiveFrom` (`YYYY-MM-01`) — data de início do regime
- Contas de crédito precisam de `closingDay > 1`; `closingDay <= 1` é tratado como conta de calendário normal
- Pagamento de fatura é uma `transaction` com `faturaAccountId` + `faturaCycleMonth` (e `categoryId = null`)
- `FaturaContext` (`{ creditMode, faturaActiveFrom, creditAccountIds }`) é 3º argumento de `getDashboardData`, `getAnnualOverview`, `getAnnualExpensesByGroup` — construir no page level
- `isFaturaMode` e `isCycleView` são mutuamente exclusivos: `isFaturaMode = !isCycleView && creditMode === 'fatura'`
- Em fatura mode, `fixedForPendency` exclui gastos fixos de crédito das pendências; `unpaidFixedCount` e `pendingFixed` derivam de `fixedForPendency`
- `getUserCreditMode(userId)` nunca retorna null — default `{ creditMode: 'accrual', faturaActiveFrom: null }`

## Ciclo de faturamento

- `billingCycleDateRange(yearMonth, closingDay)` em `lib/utils/date.ts` — retorna `{ start, end, label }` ou `null` se `closingDay <= 1`
- O `closingDay` é o **primeiro dia do novo ciclo**: ciclo de `yearMonth` vai de `closingDay` do mês anterior até `closingDay - 1` do mês atual
- Exemplo com `closingDay=8` e `yearMonth="2025-03"`: `start=2025-02-08`, `end=2025-03-07`
- `closingDay` é clampado ao último dia do mês quando o mês é mais curto (ex: fevereiro)

## Tipos

- `FaturaState` — estado de um ciclo específico de uma conta: `account`, `cycleStart/End/Month`, `total`, `transactionTotal`, `fixedExpenseTotal`, `payment | null`
- `OpenFatura` — visão consolidada de uma conta com faturas abertas: `account`, `overdueCycles[]`, `openCycle`, `closedCycle`
- `HistoricalUnpaidCycle` — ciclo histórico sem pagamento: `cycleMonth`, `cycleStart/End`, `total`, `transactionTotal`, `fixedExpenseTotal`
- `overdueCycles`: ciclos históricos com atividade (`total > 0`) mas sem pagamento registrado — distintos do ciclo aberto (em construção) e do ciclo fechado (aguardando pagamento)

## Queries

- `getFaturaState(userId, accountId, referenceMonth)` — estado de um único ciclo; retorna `null` se conta inválida ou `closingDay <= 1`
- `getOpenFaturas(userId, faturaActiveFrom)` — 3 queries bulk (`transactions`, `fixedExpenses`, `payments`) + agregação JS por conta; evita N queries por conta
- `getOpenFaturas` filtra `fixedExpenses` via `referenceMonth IN (...)` com dois meses por ciclo (mês anterior para `dueDay >= closingDay`, mês atual para `dueDay < closingDay`)

## Actions

- `createFaturaPayment` valida que total do servidor == total do cliente em centavos (`Math.round(x * 100)`) — lança `"O valor da fatura mudou"` se divergir; cliente deve fechar e reabrir o dialog
- `createFaturaPayment` rejeita pagamento se `payment.date <= cycleState.cycleEnd` — data deve ser posterior ao fechamento do ciclo
- `createFaturaPayment` rejeita se `total <= 0` — ciclo sem atividade
- `createFaturaPayment` rejeita duplicata — só um pagamento por `(faturaAccountId, faturaCycleMonth)`
- `updateCreditMode` para `'fatura'` exige pelo menos uma conta de crédito com `closingDay > 1`
- `updateCreditMode` bloqueia se houver pagamentos de fatura existentes (`faturaAccountId IS NOT NULL`) — usuário deve deletar os pagamentos antes de trocar de regime
- Nome do pagamento gerado: `"Pagamento fatura <nome da conta>"` — criptografado via DEK

## Gotchas

- `transactions` tem check constraint: `(faturaAccountId IS NULL AND categoryId IS NOT NULL) OR (faturaAccountId IS NOT NULL AND categoryId IS NULL)` — pagamentos de fatura sempre têm `categoryId = null`; transações comuns sempre têm `categoryId`
- `faturaCycleMonth` é `YYYY-MM-01` (referenceMonth format), não `YYYY-MM`
- Ciclo fechado zerado (`total == 0`) **não** deve entrar em estado de alerta — verificar `total > 0` antes de exibir badge de pendência
- `getOpenFaturas` não usa `faturaStartYearMonth` para filtrar contas — carrega todas as contas de crédito independente de quando o regime foi ativado; o filtro é só para `historicalYearMonths`
