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

### Cálculo de saldo (`lib/queries/debtors.ts`) — três laços
Adicionar tratamento explícito de `adjustment` (soma o valor **com sinal**, sem contar como cobrança):
- `getPeopleWithBalances` (~L47-58): `balance += amount` para ajuste (sinal negativo reduz). Não toca contadores.
- `getDebtorDetail` — laço `summary` (~L233-244): **novo branch** `else if (type === 'adjustment') balance += amount` — crucial aqui, pois o `else` atual incrementa `totalCharged`/`chargeCount` e contaminaria os totais.
- `getDebtorDetail` — laço `balanceEvolution` (~L251-256): `runningBalance += amount` para ajuste.

### Action (`lib/actions/debtors.ts`)
- Estender `createDebtPayment` (`CreateDebtPaymentInput` + `debtPaymentSchema` em `lib/validations/debtors.ts`) com campos opcionais para o ajuste de conciliação (ex.: flag + valor do abatimento).
- Dentro da `db.transaction` existente, após inserir o `payment` e marcar as cobranças `settled`, inserir a entrada `adjustment` (valor negativo, `status=null`, descrição tipo "Abatimento na conciliação").
- **Validação de servidor** (espelha `createFaturaPayment`): o valor do abatimento tem que igualar `soma(cobranças selecionadas) − pagamento` em centavos (`Math.round(x*100)`); divergência → erro "O valor mudou, reabra o pagamento".
- **Link para exclusão em cascata:** o `adjustment` referencia o pagamento reusando `settledByPaymentId` (evita migration). O `deleteDebtEntry` (`~L344-362`) já reseta cobranças por `settledByPaymentId`; ajustá-lo para ser **type-aware**: linhas `type='charge'` voltam a `status:'open'`; linhas `type='adjustment'` são **deletadas** junto com o pagamento.

### UI (`components/devedores/`)
- `DebtPaymentDialog`: quando o usuário seleciona cobranças e informa o valor, calcular no cliente `soma(selecionadas) − pago`; se > 0, mostrar a diferença e um controle explícito ("Registrar diferença como ajuste (abatimento)" vs "Deixar em aberto"). Dados já disponíveis via `openCharges` — sem query nova.
- `DebtEntryList`: renderizar o tipo `adjustment` (rótulo, cor, sinal do valor) ao lado de cobranças e pagamentos.

## Fora de escopo
- Botão standalone de ajuste.
- Ajuste de acréscimo (valor positivo) pela UI.
- Modelo bidirecional de dívida ("o que eu devo à pessoa").
- Conciliação em overpayment.

## Testes

**Cálculo de saldo (unit, `debtors` query — os três laços):** construir entradas diretamente para exercitar ambos os sinais, independente da UI.
- Ajuste **negativo** (abatimento): `+500 cobrança − 400 pagamento − 100 ajuste = 0` → saldo zera.
- Ajuste **positivo** (acréscimo): `+500 cobrança + 50 ajuste = 550` → saldo sobe.
- Ajuste **não contamina os contadores**: `chargeCount`/`totalCharged` e `paymentCount`/`totalPaid` ignoram o ajuste (só o branch `charge`/`payment` conta).
- `balanceEvolution`: o ponto do mês reflete o `runningBalance` com o ajuste aplicado (sinal correto).

**Action (integração com banco real):**
- `createDebtPayment` com conciliação cria **duas** entradas atômicas (`payment` + `adjustment`); `totalPaid` reflete só o pagamento; saldo final zera.
- Validação de centavos: abatimento ≠ `soma(cobranças) − pagamento` → rejeita com erro; nenhuma entrada é criada (rollback da transaction).
- Underpayment sem conciliação (flag off): comportamento atual preservado (saldo pendurado, sem ajuste).
- `deleteDebtEntry` do pagamento: remove o ajuste vinculado (`type='adjustment'` por `settledByPaymentId`) **e** reabre as cobranças (`type='charge'` → `status:'open'`); saldo volta ao estado pré-pagamento.
