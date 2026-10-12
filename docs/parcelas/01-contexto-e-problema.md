# Parcelas — Contexto e Problema

## Contexto

Compras parceladas criam um `installmentGroup` e N `transactions`, uma por mês. Cada transação recebe:

- `date`: resultado de `addMonths(purchaseDate, i)` — mantém o dia exato da compra
- `referenceMonth`: resultado de `startOfMonth(installmentDate)` — ignora `closingDay`

Esse modelo funciona superficialmente, mas apresenta dois bugs em contas de crédito com `closingDay`.

---

## Bug 1 — `referenceMonth` errado na parcela 1

Quando a data da compra é **igual ou posterior** ao `closingDay`, a transação pertence à fatura do mês seguinte. O código atual ignora isso.

**Exemplo:** `closingDay = 16`, compra em 18/jan

| Comportamento | referenceMonth parcela 1 |
| ------------- | ------------------------ |
| Atual (errado) | Janeiro |
| Correto | **Fevereiro** (18 > 16 → próxima fatura) |

---

## Bug 2 — Duas parcelas na mesma fatura

Decorrência do Bug 1: se o `referenceMonth` base está errado, e as parcelas 2+ usam dia 1 do mês seguinte calendário, duas parcelas acabam na mesma fatura.

**Exemplo:** `closingDay = 16`, compra em 18/jan, parcelas 2+ com dia 1

| Parcela | Data | Ciclo | referenceMonth |
| ------- | ---- | ----- | -------------- |
| 1 | 18/jan | 16/jan → 15/fev | ✅ Fevereiro |
| 2 | 01/fev | 16/jan → 15/fev | ❌ Fevereiro (mesmo ciclo!) |
| 3 | 01/mar | 16/fev → 15/mar | ✅ Março |

O ciclo de um mês vai do `closingDay` do mês anterior até a véspera do `closingDay` do mês atual — o `closingDay` é o **primeiro** dia do novo ciclo (`billingCycleDateRange`).

---

## Algoritmo Correto

### Definição de `closingDay` efetivo

`closingDay <= 1` é tratado como **sem fechamento** — equivalente a `null`. Isso é consistente com `billingCycleDateRange`, que retorna `null` para `closingDay <= 1` (ciclo calendário normal). Na prática, um cartão com `closingDay = 1` tem seu ciclo de dia 1 a dia 31, o que é idêntico ao comportamento de débito/pix.

```
closingDayEfetivo = (closingDay !== null && closingDay > 1) ? closingDay : null
```

### Passo 1 — Calcular `baseReferenceMonth`

```
se closingDayEfetivo existe:
  // mês do ciclo que contém a compra: compara a data cheia com o início do ciclo seguinte
  // (billingCycleDateRange, closingDay clampado ao tamanho do mês — ex.: 29 em fev/2025 → 28)
  baseReferenceMonth = purchaseDate >= início do ciclo de (mês da compra + 1)
    ? mês da compra + 1
    : mês da compra
senão:
  baseReferenceMonth = startOfMonth(purchaseDate)
```

### Passo 2 — Para cada parcela i

```
referenceMonth[i] = addMonths(baseReferenceMonth, i)

se i === 0:
  date[i] = purchaseDate  (data real da compra)
senão se closingDayEfetivo existe:
  // segundo dia do ciclo de referenceMonth[i] (início clampado de billingCycleDateRange + 1):
  // closingDayEfetivo + 1 do mês anterior, ou dia 1 de referenceMonth[i] quando o closingDay
  // é o último dia do mês anterior (ou passa dele)
  date[i] = addDays(início do ciclo de referenceMonth[i], 1)
senão:
  date[i] = setDate(referenceMonth[i], 1)
```

---

## Cenários de Validação

### Conta sem closingDay (débito / pix)

| Parcela | Data | referenceMonth |
| ------- | ---- | -------------- |
| 1 | 18/jan | Janeiro ✅ |
| 2 | 01/fev | Fevereiro ✅ |
| 3 | 01/mar | Março ✅ |

---

### Crédito `closingDay = 16`, compra em 05/jan (antes do fechamento)

`baseReferenceMonth` = Janeiro (5 < 16)

| Parcela | Data | referenceMonth |
| ------- | ---- | -------------- |
| 1 | 05/jan | Janeiro ✅ |
| 2 | 17/jan (closingDay+1) | Fevereiro ✅ (17 ≥ 16 → próxima fatura) |
| 3 | 17/fev | Março ✅ |

---

### Crédito `closingDay = 16`, compra em 18/jan (depois do fechamento)

`baseReferenceMonth` = Fevereiro (18 ≥ 16)

| Parcela | Data | referenceMonth |
| ------- | ---- | -------------- |
| 1 | 18/jan | Fevereiro ✅ |
| 2 | 17/fev (closingDay+1) | Março ✅ (17 ≥ 16) |
| 3 | 17/mar | Abril ✅ |

---

### Crédito `closingDay = 28`, compra em 30/jan — edge case mês curto

`baseReferenceMonth` = Fevereiro (30 ≥ 28)

| Parcela | Data | Cálculo | referenceMonth |
| ------- | ---- | ------- | -------------- |
| 1 | 30/jan | — | Fevereiro ✅ |
| 2 | 01/mar (fallback) | dia 29 não existe em fev não-bissexto → fallback dia 1 de março | Março ✅ |
| 3 | 29/mar (closingDay+1) | dia 29 existe em março | Abril ✅ (29 ≥ 28) |

---

### Crédito `closingDay = 1` — tratado como calendário

`closingDay = 1` significa que o ciclo vai do dia 1 ao último dia do mês — idêntico ao mês calendário. `closingDayEfetivo` é `null`.

| Parcela | Data | referenceMonth |
| ------- | ---- | -------------- |
| 1 | 18/jan | Janeiro ✅ |
| 2 | 01/fev | Fevereiro ✅ |
| 3 | 01/mar | Março ✅ |

---

## Por que não usar sempre `closingDay + 1`

`closingDay + 1` é semanticamente preciso — marca o primeiro dia do novo ciclo. Mas exige fallback obrigatório quando o dia não existe no mês anterior (e.g., `closingDay = 28` em fevereiro). A lógica trata isso explicitamente via `getDaysInMonth`.

## Por que não usar sempre dia 1

Dia 1 funciona para todos os casos de `referenceMonth` (dia 1 < qualquer `closingDay` relevante), mas perde a semântica de "início do ciclo" para usuários em modo fatura. A proposta prioriza precisão onde possível, com fallback seguro.

---

## Dados Existentes

Parcelas já criadas com a lógica antiga têm `referenceMonth` potencialmente errado para contas com `closingDay`. A correção cobre apenas parcelas **futuras** (`referenceMonth > currentReferenceMonth`) — o passado não é alterado para preservar o histórico que o usuário já visualizou e reconciliou.

A correção das parcelas futuras existentes é feita por script standalone, detalhado em `02-plano-de-implementacao.md`.
