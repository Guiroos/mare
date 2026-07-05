# Devedores — Ajuste de saldo via conciliação no pagamento

**Data:** 2026-07-05
**Domínio:** Devedores (`lib/*/debtors.*`, `components/devedores/`)

## Problema

Ao registrar um pagamento que quita cobranças cujo total **não bate** com o valor pago, o saldo fica pendurado sem forma de acerto. Caso real: a pessoa devia R$ 500 (cobranças no sistema), o usuário devia R$ 100 a ela (não rastreado), e ela pagou R$ 400 líquido. Ao lançar 400 e marcar as cobranças de 500 como quitadas, o saldo trava em R$ 100 — falta um lançamento de acerto que represente o abatimento.

O tipo `adjustment` já existe no enum de `debtorEntries.type` (`lib/db/schema.ts:499`) e no tipo TS (`lib/queries/debtors.ts:93`), mas está **inacabado**: nenhuma action o cria e o cálculo de saldo o trata como cobrança (só soma). Este spec finaliza a feature.

## Decisões de design

1. **Ajuste é lançamento de primeira classe, com valor com sinal.** Um `debtorEntries` `type='adjustment'`, `status=null`, `amount` com sinal: negativo = abatimento (reduz o saldo), positivo = acréscimo (raro; correção pra mais). O escopo atual só produz abatimento (valor negativo).

2. **Conciliação vive dentro do dialog de pagamento, mas gera duas entradas.** UX unificada, responsabilidades separadas: um `payment` (−400, dinheiro real) **e** um `adjustment` (−100, acerto) — nunca um pagamento fundido de 500. Isso mantém `totalPaid`, `chargeCount` e o income gerado honestos. As duas entradas são criadas atomicamente numa `db.transaction`.

3. **Conciliação é escolha explícita, não automática.** Uma diferença entre pago e cobranças selecionadas pode ser erro. O dialog exibe a diferença e o usuário opta por registrar o ajuste ou deixar em aberto.

4. **Sem botão standalone de ajuste agora (YAGNI).** O único ponto de entrada é a conciliação no pagamento. A criação da entrada de ajuste fica isolada num helper reutilizável, de modo que promover a um botão avulso — ou, mais adiante, a um modelo de "dívidas que eu devo à pessoa" — seja trivial. Nenhum dos dois entra neste escopo.

## Escopo

**Só o caso de underpayment** (pago < soma das cobranças selecionadas → abatimento). Overpayment (pago > cobranças) segue o comportamento atual (saldo fica negativo = crédito da pessoa); não oferece ajuste.

## Mudanças

### Data / schema
- Nenhuma migration. `type` já é `varchar(20)` sem check constraint; `amount` é `text` (aceita `"-100"`); `status` é nullable (ajuste usa `null`).

### Cálculo de saldo (`lib/queries/debtors.ts`)
Com valor **com sinal**, o saldo já fica correto: os três laços somam ajuste via o branch `else → += amount` (um ajuste de −100 reduz o saldo). A **única correção funcional** é no laço `summary` de `getDebtorDetail` (~L233-244), que hoje conta o ajuste como cobrança:
- `summary` (~L233-244): **novo branch** `else if (type === 'adjustment') { balance += e.amount }` — mantém o efeito no saldo, mas **não** incrementa `totalCharged`/`chargeCount` (senão os totais contaminam).
- `getPeopleWithBalances` (~L47-58) e `balanceEvolution` (~L251-256): saldo já correto; adicionar comentário deixando explícito que ajustes com sinal fluem pelo branch da cobrança. Sem mudança de comportamento.

### Action (`lib/actions/debtors.ts`)
- Estender `createDebtPayment` (`CreateDebtPaymentInput` + `debtPaymentSchema` em `lib/validations/debtors.ts`) com **uma flag** `reconcileRemainder?: boolean`.
- **O servidor calcula o abatimento** (não confia em valor do cliente): dentro da `db.transaction` existente, quando `reconcileRemainder` e há `settleChargeIds`, seleciona as cobranças, decripta e soma; `diff = soma − pagamento`. Se `diff > 0` (underpayment), insere a entrada `adjustment` de `-diff` (`status=null`, descrição "Abatimento — conciliação de pagamento", `entryDate`/`referenceMonth` do pagamento). Se `diff <= 0`, ignora a flag (sem ajuste). Sem erro de "valor mudou" — servidor é a fonte da verdade.
- **Link para exclusão em cascata:** o `adjustment` referencia o pagamento reusando `settledByPaymentId` (evita migration). O `deleteDebtEntry` (`~L344-362`) já reseta cobranças por `settledByPaymentId`; ajustá-lo para ser **type-aware**: linhas `type='adjustment'` são **deletadas** junto com o pagamento; linhas `type='charge'` voltam a `status:'open'`.

### UI (`components/devedores/`)
- `DebtPaymentDialog`: já calcula `selectedTotal`, `paymentAmount` e `isOverAmount` (selecionado > pago). Quando `isOverAmount`, exibir a diferença e um toggle explícito ("Registrar diferença como ajuste (abatimento)"); ao submeter, mandar `reconcileRemainder` só quando o toggle está ligado. Sem query nova. Resetar o estado no `handleOpenChange(false)`.
- `DebtEntryList`: renderizar o tipo `adjustment` sem quebrar com valor negativo — sinal derivado de `entry.amount < 0`, `formatCurrency(Math.abs(...))`, cor neutra (`text-text-secondary`), ícone/`Badge` próprios ("Ajuste"). `netTotal` e filtro já tratam ajuste pelo branch de não-pagamento — sem mudança.

## Fora de escopo
- Botão standalone de ajuste.
- Ajuste de acréscimo (valor positivo) pela UI.
- Modelo bidirecional de dívida ("o que eu devo à pessoa").
- Conciliação em overpayment.

## Testes

**Cálculo de saldo (integração, `getDebtorDetail`):** construir entradas via factory (amount plaintext, `decryptField` é backward-compat) para exercitar ambos os sinais.
- Driver TDD — **contadores**: `+500 cobrança − 400 pagamento − 100 ajuste` → `chargeCount === 1`, `totalCharged === 500` (antes do fix seriam 2 e 400).
- Saldo (caracterização): mesmo cenário → `balance === 0`; ajuste positivo `+500 + 50` → `balance === 550`.
- `balanceEvolution`: ponto do mês reflete o `runningBalance` com o ajuste aplicado (sinal correto).

**Action (integração com banco real):**
- `createDebtPayment` com `reconcileRemainder` cria **duas** entradas atômicas (`payment` + `adjustment` de `-diff`); `totalPaid` reflete só o pagamento; saldo final zera; ajuste linkado via `settledByPaymentId`.
- `reconcileRemainder` com `diff <= 0` (sem underpayment) → nenhum ajuste criado.
- Underpayment sem a flag → comportamento atual preservado (saldo pendurado, sem ajuste).
- `deleteDebtEntry` do pagamento: remove o ajuste vinculado (`type='adjustment'` por `settledByPaymentId`) **e** reabre as cobranças (`type='charge'` → `status:'open'`); saldo volta ao estado pré-pagamento.
