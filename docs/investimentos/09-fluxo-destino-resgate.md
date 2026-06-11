# Tech Spec: Revisão do Fluxo de Destino de Resgate

> **Status: planejado** (junho/2026)

## Contexto

O documento `08-retorno-capital-panorama.md` introduziu `investmentReturnCapital` para
separar capital de rendimento no income criado por um resgate com `destination = 'income'`.
A implementação funcionou corretamente para o caso de vencimento completo com reinvestimento,
mas introduziu um bug em resgates parciais de emergência.

### Bug detectado (junho/2026)

Usuario com R$3.000 aportado num tipo de investimento fez um resgate de emergência de
R$50 (`destination = 'income'`). O income criado tinha `amount = 50` e
`investmentReturnCapital = 3000` (total aportado no tipo). O dashboard calculou:

```
totalIncomes = (3600 + 50) - 3000 = 650
```

Em vez de R$3.650, o card de entradas exibiu R$650. O balance ficou R$2.950 abaixo do
real.

### Causa raiz

A action `createWithdrawal` sempre setava `investmentReturnCapital = total_capital_do_tipo`
para qualquer `destination = 'income'`, sem distinguir a intenção do usuário:

- **Emergência / saque final**: o dinheiro entra no caixa — `investmentReturnCapital`
  deve ser `null`, o income aparece integralmente como entrada.
- **Reinvestimento (rolagem)**: o capital continua investido, só o rendimento é renda
  nova — `investmentReturnCapital = min(resgate, total_capital)` é o comportamento correto.

Um único campo (`destination = 'income'`) cobria dois casos com semânticas opostas, e
o código aplicava a lógica de rolagem para todos indiscriminadamente.

## Análise dos Cenários

### Cenário A — Emergência (resgate parcial ou total para uso pessoal)

```
Mês do aporte:      totalInvested += 3000  →  balance -= 3000
Mês do resgate:     totalIncomes  += 50    →  balance += 50
Net acumulado:      -2950  (ainda tem R$2.950 investido)
```

`investmentReturnCapital = null`. O income aparece integralmente. O balance reflete
que o usuário sacou R$50 do que estava alocado.

### Cenário B — Vencimento sem reinvestimento

```
Mês do aporte:      totalInvested += 3000  →  balance -= 3000
Mês do vencimento:  totalIncomes  += 3450  →  balance += 3450
Net acumulado:      +450  (rendimento real após imposto)
```

Também `investmentReturnCapital = null`. Ao longo dos meses o balance acumulado
reflete corretamente só o lucro. O income do mês do vencimento mostra R$3.450 —
que é o valor que o usuário efetivamente recebeu na conta.

### Cenário C — Vencimento com reinvestimento total (rolagem)

O usuário resgata R$3.450 e quer reinvestir tudo. Deseja que o dashboard não infle
as entradas do mês com os R$3.000 de capital que já saíram como investimento no passado.

Única combinação que produz balance correto:

| Passo | Income | Invested | Balance no mês |
|---|---|---|---|
| Resgate (`destination = 'reinvest'`, `iRC = 3000`) | +450 | — | +450 |
| Novo aporte com `excludeFromCashFlow = true` | — | +0 | +450 |
| **Net** | **+450** | **+0** | **+450** ✓ |

Qualquer outra combinação ou produz saldo errado ou esconde o rendimento junto com
o capital.

Nota: o novo aporte **obrigatoriamente** precisa de `excludeFromCashFlow = true`. Sem
ele, `totalInvested += 3450` e o balance do mês fica `-3000` (como se o usuário tivesse
investido dinheiro novo do bolso). A UI deve lembrar o usuário disso.

## Decisão Arquitetural

### Novo valor de `destination`: `'reinvest'`

O campo `destination` em `investmentWithdrawals` é `varchar(20)` sem constraint de
enum — aceita novos valores sem migration.

| Valor | Income criado | `investmentReturnCapital` | Caso de uso |
|---|---|---|---|
| `'income'` | Sim | `null` | Emergência, saque final |
| `'reinvest'` | Sim | `min(resgate, total_capital)` | Rolagem / vencimento com reinvestimento |
| `'transfer'` | Não | — | Legado (sem novos registros via UI) |

O `'transfer'` permanece suportado no código para não quebrar registros históricos,
mas o formulário deixa de oferecê-lo como opção.

### Por que não um boolean `isReinvestment`

O `destination` já é o discriminador natural do resgate. Adicionar um boolean separado
duplicaria a informação e tornaria `createWithdrawal` mais difícil de rastrear
retroativamente (um resgate com `destination = 'income'` deixaria de ser auto-explicativo).
Com `'reinvest'` como valor, a intenção fica legível diretamente na tabela.

### Por que não remover `investmentReturnCapital` completamente

O Cenário C requer que o dashboard exiba só o rendimento como renda nova. Sem
`investmentReturnCapital`, a única alternativa seria `destination = 'transfer'` +
aporte normal — mas aí o rendimento desaparece do dashboard (documentado em
`08-retorno-capital-panorama.md` como comportamento incorreto).

## Arquivos Afetados

### `lib/validations/investments.ts`

```ts
// Antes
destination: z.enum(['income', 'transfer'])

// Depois
destination: z.enum(['income', 'reinvest', 'transfer'])
```

### `lib/actions/investments.ts` — `createWithdrawal`

Remover o bloco que sempre calculava `investmentReturnCapital`. Substituir por:

```ts
let investmentReturnCapital: string | null = null

if (data.destination === 'reinvest') {
  const [capitalRow] = await db
    .select({ total: sum(investments.amount) })
    .from(investments)
    .where(
      and(
        eq(investments.userId, userId),
        eq(investments.investmentTypeId, data.investmentTypeId)
      )
    )
  investmentReturnCapital = String(
    Math.min(Number(data.amount), Number(capitalRow?.total ?? 0))
  )
}
```

Income inserido com `investmentReturnCapital` apenas quando `'reinvest'`.
Quando `'income'`, o campo fica `null` e o income aparece integralmente.

### `lib/actions/investments.ts` — `updateWithdrawal`

Hoje não atualiza `investmentReturnCapital` ao editar valor ou data. Isso é um bug
latente para resgates `'reinvest'`: se o usuário editar o amount de R$500 para R$200
mas `investmentReturnCapital` continuar em R$500, o income líquido fica R$-300.

Ao salvar, quando `withdrawal.destination === 'reinvest'`, recalcular:

```ts
// dentro do db.transaction, antes de atualizar o income
if (withdrawal.destination === 'reinvest' && withdrawal.incomeId) {
  const [capitalRow] = await tx
    .select({ total: sum(investments.amount) })
    .from(investments)
    .where(
      and(
        eq(investments.userId, userId),
        eq(investments.investmentTypeId, data.investmentTypeId)
      )
    )
  const newReturnCapital = String(
    Math.min(Number(data.amount), Number(capitalRow?.total ?? 0))
  )
  await tx
    .update(incomes)
    .set({
      amount: data.amount,
      referenceMonth: dateToReferenceMonth(data.date),
      investmentReturnCapital: newReturnCapital,
    })
    .where(and(eq(incomes.id, withdrawal.incomeId), eq(incomes.userId, userId)))
}
```

Para `destination === 'income'`, manter o comportamento atual (atualiza só `amount`
e `referenceMonth`, `investmentReturnCapital` permanece `null`).

### `components/investimentos/WithdrawalDialog.tsx`

Trocar o `<Select>` de destino de 2 para 2 opções (removendo `'transfer'`, adicionando
`'reinvest'`):

```tsx
<SelectItem value="income">Caixa (uso pessoal / emergência)</SelectItem>
<SelectItem value="reinvest">Reinvestimento (mostrar só rendimento)</SelectItem>
```

Quando `destination === 'reinvest'`, exibir hint:

> "Ao criar o novo aporte, marque 'Já tinha o valor' para que o capital não seja
> contabilizado como saída do caixa novamente."

Estado inicial do select: `'income'` (caso mais comum).

## Dados Históricos

Registros existentes com `destination = 'income'` e `investmentReturnCapital` calculado
incorretamente (capital total, não `min`) permanecem no banco. O código novo não os
corrige retroativamente.

Usuários afetados precisam deletar e recriar o resgate. A UI não exibe aviso sobre
registros antigos — custo de comunicação alto para um cenário raro.

Registros com `destination = 'transfer'` são preservados e continuam funcionando
(sem income, sem impacto no caixa).

## Critérios de Aceite

- [ ] Resgate de emergência (R$50 de tipo com R$3.000 aportado): income aparece como
  +R$50 no dashboard, sem subtração de capital.
- [ ] Resgate de reinvestimento (R$3.450 de tipo com R$3.000 aportado): income líquido
  no dashboard = R$450 (só rendimento).
- [ ] Editar amount de um resgate `'reinvest'`: `investmentReturnCapital` é recalculado;
  income líquido nunca fica negativo.
- [ ] Registros com `destination = 'transfer'` existentes continuam sem income e sem
  impacto no caixa.
- [ ] O select do formulário exibe exatamente 2 opções; `'transfer'` não aparece.
- [ ] Hint sobre `excludeFromCashFlow` é visível quando `'reinvest'` está selecionado.

## Riscos e Limitações

- **Resgates parciais de reinvestimento**: `investmentReturnCapital = min(resgate,
  total_capital)` assume que o capital retornado é proporcionalmente o menor valor.
  Em múltiplos resgates parciais do mesmo tipo, o capital acumulado somado pode
  ultrapassar o total aportado. Aceitável — o `min` garante que `investmentReturnCapital`
  nunca excede o `amount`, impedindo income negativo.

- **Aportes editados após o resgate `'reinvest'`**: `investmentReturnCapital` não é
  recalculado quando aportes históricos são alterados. Mesma limitação documentada em
  `08-retorno-capital-panorama.md`.

- **Usuários com registros `'income'` antigos com `investmentReturnCapital` errado**:
  continuam exibindo valores incorretos. Sem correção automática.
