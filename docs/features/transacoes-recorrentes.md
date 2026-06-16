# Transações Recorrentes

## Problema / Contexto

O Maré tem `fixedExpenses` para gastos fixos mensais (valor constante, categoria fixa). Mas há uma lacuna: transações variáveis que se repetem — salário, aluguel recebido, assinaturas com valores que mudam. Hoje o usuário precisa relançar manualmente todo mês. YNAB e Mobills permitem marcar qualquer transação como recorrente.

## O que já temos

- `fixedExpenses` cobre bem gastos fixos com valor constante e rollover automático via cron
- `incomes` é lançado manualmente todo mês
- Schema de `transactions` tem `description`, `categoryId`, `accountId` — base para templates

## MVP — como fazer

**Conceito:** "templates de transação" — um registro que define os campos padrão de uma transação recorrente, sem criar a transação automaticamente.

**Fluxo:** ao lançar uma transação, opção "marcar como recorrente". Isso cria um `transactionTemplate` com os campos da transação. No início do próximo mês, o dashboard exibe um card "Você tem X lançamentos recorrentes pendentes" com botão para confirmar cada um (possivelmente editando o valor antes de confirmar).

**Schema:**
```
transactionTemplates: id, userId, description, categoryId, accountId, 
                      defaultAmount, type (expense/income), active
```

**Diferença de `fixedExpenses`:** templates são sugeridos, não lançados automaticamente. O usuário confirma e pode ajustar o valor. Isso evita lançamentos errados quando o valor muda (ex: conta de luz).

## Fora do MVP

- Lançamento automático sem confirmação (opt-in por template)
- Frequência diferente de mensal (semanal, anual)
- Detecção automática de recorrência por histórico (ML/heurística)
- Agrupamento de templates em "perfil de mês"
