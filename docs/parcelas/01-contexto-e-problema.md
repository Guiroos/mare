# Parcelas — Contexto e Problema

## Contexto

Compras parceladas criam um `installmentGroup` e N `transactions`, uma por mês. Cada transação recebe:

- `date`: resultado de `addMonths(purchaseDate, i)` — mantém o dia exato da compra
- `referenceMonth`: resultado de `startOfMonth(installmentDate)` — ignora `closingDay`

Esse modelo funciona superficialmente, mas apresenta dois bugs em contas de crédito com `closingDay`.

---

## Bug 1 — `referenceMonth` errado na parcela 1

Quando a data da compra é **posterior** ao `closingDay`, a transação pertence à fatura do mês seguinte. O código atual ignora isso.

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
| 1 | 18/jan | jan 17 → fev 16 | ✅ Fevereiro |
| 2 | 01/fev | jan 17 → fev 16 | ❌ Fevereiro (mesmo ciclo!) |
| 3 | 01/mar | fev 17 → mar 16 | ✅ Março |

---

## Algoritmo Correto

### Passo 1 — Calcular `baseReferenceMonth`

```
se closingDay existe E getDate(purchaseDate) > closingDay:
  baseReferenceMonth = startOfMonth(addMonths(purchaseDate, 1))
senão:
  baseReferenceMonth = startOfMonth(purchaseDate)
```

### Passo 2 — Para cada parcela i

```
referenceMonth[i] = addMonths(baseReferenceMonth, i)

se i === 0:
  date[i] = purchaseDate  (data real da compra)
senão se closingDay existe:
  prevMonth = subMonths(referenceMonth[i], 1)
  se (closingDay + 1) <= getDaysInMonth(prevMonth):
    date[i] = setDate(prevMonth, closingDay + 1)  // primeiro dia do ciclo
  senão:
    date[i] = setDate(referenceMonth[i], 1)        // fallback: dia 1 do mês
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

`baseReferenceMonth` = Janeiro (5 ≤ 16)

| Parcela | Data | referenceMonth |
| ------- | ---- | -------------- |
| 1 | 05/jan | Janeiro ✅ |
| 2 | 17/jan (closingDay+1) | Fevereiro ✅ (17 > 16 → próxima fatura) |
| 3 | 17/fev | Março ✅ |

---

### Crédito `closingDay = 16`, compra em 18/jan (depois do fechamento)

`baseReferenceMonth` = Fevereiro (18 > 16)

| Parcela | Data | referenceMonth |
| ------- | ---- | -------------- |
| 1 | 18/jan | Fevereiro ✅ |
| 2 | 17/fev (closingDay+1) | Março ✅ (17 > 16) |
| 3 | 17/mar | Abril ✅ |

---

### Crédito `closingDay = 28`, compra em 30/jan — edge case mês curto

`baseReferenceMonth` = Fevereiro (30 > 28)

| Parcela | Data | Cálculo | referenceMonth |
| ------- | ---- | ------- | -------------- |
| 1 | 30/jan | — | Fevereiro ✅ |
| 2 | 01/mar (fallback) | dia 29 não existe em fev não-bissexto → fallback dia 1 de março | Março ✅ |
| 3 | 29/mar (closingDay+1) | dia 29 existe em março | Abril ✅ (29 > 28) |

---

## Por que não usar sempre `closingDay + 1`

`closingDay + 1` é semanticamente preciso — marca o primeiro dia do novo ciclo. Mas exige fallback obrigatório quando o dia não existe no mês anterior (e.g., `closingDay = 28` em fevereiro). A lógica trata isso explicitamente via `getDaysInMonth`.

## Por que não usar sempre dia 1

Dia 1 funciona para todos os casos de `referenceMonth` (dia 1 < qualquer `closingDay` relevante), mas perde a semântica de "início do ciclo" para usuários em modo fatura. A proposta prioriza precisão onde possível, com fallback seguro.

---

## Dados Existentes

Parcelas já criadas com a lógica antiga têm `referenceMonth` potencialmente errado para contas com `closingDay`. A correção cobre apenas parcelas **futuras** (`referenceMonth > currentReferenceMonth`) — o passado não é alterado para preservar o histórico que o usuário já visualizou e reconciliou.

A correção das parcelas futuras existentes é feita por script standalone, detalhado em `02-plano-de-implementacao.md`.
