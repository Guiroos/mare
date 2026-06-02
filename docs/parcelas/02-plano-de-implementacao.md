# Parcelas — Plano de Implementação

## Fase 1 — Correção da Action

**Arquivo:** `lib/actions/transactions.ts` — `createInstallmentPurchase`

### Checklist

- [ ] Buscar `closingDay` da conta via `db.select` usando o `accountId` recebido
- [ ] Extrair helper `calcBaseReferenceMonth(purchaseDate, closingDay)` em `lib/utils/date.ts`
- [ ] Extrair helper `calcInstallmentDate(referenceMonth, closingDay, isFirst, purchaseDate)` em `lib/utils/date.ts`
- [ ] Atualizar o loop de geração de parcelas em `createInstallmentPurchase`:
  - `referenceMonth[i]` = `addMonths(baseReferenceMonth, i)`
  - `date[0]` = `purchaseDate`
  - `date[i > 0]` = `closingDay + 1` do mês anterior com fallback para dia 1 do `referenceMonth`
- [ ] Garantir que a query de `closingDay` é paralela ao `assertOwnsPaymentAccount` (já existe no `Promise.all`)

### Assinatura dos helpers (referência)

```typescript
// lib/utils/date.ts

export function calcBaseReferenceMonth(purchaseDate: Date, closingDay: number | null): Date
// Retorna o startOfMonth correto para a parcela 1, considerando closingDay.
// closingDay <= 1 é tratado como null (comportamento de calendário).

export function calcInstallmentDate(
  referenceMonth: Date,   // referenceMonth da parcela i (já calculado)
  closingDay: number | null,
): Date
// Retorna a date para parcelas 2+.
// closingDay + 1 do mês anterior se o dia existir; caso contrário dia 1 do referenceMonth.
// closingDay <= 1 é tratado como null (retorna dia 1 do referenceMonth).
```

### Critérios de aceite — Fase 1

- Compra dia 5, `closingDay = 16` → parcela 2 com data 17 do mesmo mês, `referenceMonth` do mês seguinte
- Compra dia 18, `closingDay = 16` → parcela 1 com `referenceMonth` do mês seguinte; parcela 2 com data 17 do mês seguinte
- Compra dia 30, `closingDay = 28` em janeiro → parcela 2 com fallback dia 1 de março, `referenceMonth` março
- Compra sem `closingDay` (débito) → parcelas 2+ com dia 1 de cada mês, `referenceMonth` correto
- Compra dia 18, `closingDay = 1` → comportamento idêntico a sem `closingDay` (ciclo calendário)

---

## Fase 2 — Script de Migração

**Arquivo a criar:** `scripts/fix-installment-dates.ts`

O script corrige parcelas futuras existentes que foram criadas com a lógica antiga.

### Escopo

- Apenas transações com `installmentGroupId IS NOT NULL`
- Apenas `referenceMonth > currentReferenceMonth` (futuras)
- Parcela 1 (`installmentNumber = 1`) de cada grupo: apenas `referenceMonth` é recalculado; `date` não é alterada (é a data real da compra)
- Parcelas 2+: `date` e `referenceMonth` são recalculados com o novo algoritmo

### Checklist

- [ ] Criar `scripts/fix-installment-dates.ts`
- [ ] Buscar todos os `installmentGroups` que possuem ao menos uma parcela futura
- [ ] Para cada grupo, buscar `closingDay` via join com `paymentAccounts`
- [ ] Para cada parcela futura do grupo, calcular os valores corretos usando os helpers da Fase 1
- [ ] Executar as atualizações dentro de `db.transaction`
- [ ] Logar um resumo: grupos processados, parcelas atualizadas, grupos sem mudança
- [ ] Dry-run mode via flag `--dry-run` que imprime o diff sem aplicar

### Execução

```bash
# Revisão sem aplicar
npx tsx scripts/fix-installment-dates.ts --dry-run

# Aplicar
npx tsx scripts/fix-installment-dates.ts
```

### Critérios de aceite — Fase 2

- `--dry-run` imprime grupos afetados com os valores antes/depois sem alterar o banco
- Grupos sem `closingDay` (débito/pix): parcelas 2+ atualizadas para dia 1, `referenceMonth` inalterado se já estava correto
- Grupos com `closingDay`: `referenceMonth` e `date` recalculados conforme algoritmo
- Nenhuma parcela com `referenceMonth <= currentReferenceMonth` é tocada
- Script é idempotente: rodar duas vezes produz o mesmo resultado

---

## Fase 3 — Testes

### Testes unitários — helpers de data (`lib/utils/date.ts`)

- [ ] `calcBaseReferenceMonth` — 5 casos: sem closingDay, closingDay=1 (calendário), com closingDay antes, com closingDay exato, com closingDay depois
- [ ] `calcInstallmentDate` — 6 casos: sem closingDay, closingDay=1 (calendário), dia válido no mês anterior, fallback fevereiro não-bissexto (`closingDay = 28`), fallback mês com 30 dias (`closingDay = 30`), `closingDay = 31`

### Testes de integração — action (`createInstallmentPurchase`)

- [ ] Conta débito: 3 parcelas → datas e `referenceMonth` corretos
- [ ] Conta crédito, compra antes do fechamento: `referenceMonth` da parcela 1 no mês da compra
- [ ] Conta crédito, compra depois do fechamento: `referenceMonth` da parcela 1 no mês seguinte
- [ ] Conta crédito com `closingDay = 28`, compra em janeiro: fallback fevereiro não-bissexto

### Critérios de aceite — Fase 3

- Cobertura dos helpers ≥ 80% → adicionar entrada em `thresholds.perFile` no `vitest.config.ts`
- Todos os cenários de validação do `01-contexto-e-problema.md` cobertos por testes

---

## Ordem de Execução

```
Fase 1 → Fase 3 (unitários dos helpers) → Fase 3 (integração da action) → Fase 2 → Fase 3 (validar script)
```

Fase 2 depende dos helpers da Fase 1 estarem prontos e testados. O script não precisa de testes automatizados próprios — o dry-run serve como validação manual antes da aplicação.
