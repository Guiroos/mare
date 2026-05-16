# Devedores — Backend

## Validações — `lib/validations/debtors.ts`

| Schema             | Campos principais                                                                 |
| ------------------ | --------------------------------------------------------------------------------- |
| `personSchema`     | nome obrigatório; email opcional em formato válido; telefone como string simples  |
| `debtChargeSchema` | valor > 0; `entryDate` obrigatório; descrição obrigatória; sem `referenceMonth`   |
| `debtPaymentSchema`| valor > 0; `entryDate` obrigatório; descrição obrigatória; `referenceMonth` obrigatório apenas quando `createIncome: true` — validar via `refine` cruzando os dois campos |

`debtAdjustmentSchema` não entra na v1. O tipo `adjustment` existe no banco para uso futuro, mas não há UI nem validação até que haja caso de uso concreto. Correções na v1 são feitas por exclusão e recriação do lançamento.

## Queries — `lib/queries/debtors.ts`

### `getPeopleWithBalances(userId)`

Lista pessoas não arquivadas com:

- Saldo calculado (`charge - payment + adjustment`)
- Data do último movimento

Evitar N+1: usar `GROUP BY personId` numa única query.

Os totais dos cards de resumo (total em aberto, contagem de pessoas com saldo positivo) são calculados em JS a partir do resultado desta query — sem query `SUM` separada. Mesmo padrão de `dashboard.ts` e `panorama.ts`.

`dueDate` existe no schema mas não é exposto na UI da v1 — card de "valores vencidos" entra apenas quando o campo for usado na prática.

### `getPersonDebtDetails(userId, personId)`

Retorna atualmente:

- Dados da pessoa
- `balance` (saldo atual no nível raiz)
- Histórico de lançamentos ordenado por `entryDate DESC`
- Dados resumidos da transação vinculada quando `sourceTransactionId` existir

> Mudança planejada (Fase 1 de `06-planejamento-detalhe-pessoa.md`): `balance` será removido do nível raiz e substituído por um objeto `summary` com `balance`, `totalCharged` (charge + adjustment), `totalPaid`, `lastMovement`, `chargeCount` e `paymentCount`. A query também passará a retornar `balanceEvolution` calculado server-side.

### `getTransactionsForDebtLink(userId)`

Retorna transações dos últimos 6 meses disponíveis para vínculo: `id`, `name`, `amount`, `date`, `category`, `account`.

Sem filtro por mês do caller — a janela de 6 meses é fixa na query. Cobre a grande maioria dos casos reais; transações mais antigas podem ser referenciadas registrando a cobrança sem vínculo.

Implementada na Fase 6.

---

Notas gerais:

- Usar `toAmount()` para converter decimals.
- Preferir agregações com `GROUP BY` quando a lista crescer.

## Actions — `lib/actions/debtors.ts`

| Função                           | Descrição                                                              |
| -------------------------------- | ---------------------------------------------------------------------- |
| `createPerson(data)`             | Cria pessoa                                                            |
| `updatePerson(data)`             | Atualiza nome, contato, notas; atualiza `updatedAt`                    |
| `archivePerson(id)`              | Define `archived = true`                                               |
| `deletePersonIfEmpty(id)`        | Apaga apenas se não houver lançamentos; caso contrário, erro           |
| `createDebtCharge(data)`         | Cria `debtor_entries.type = charge` sem transação de origem            |
| `createDebtChargeFromTransaction(data)` | Cria `charge` com `sourceTransactionId`; valida ownership da transação via query com `userId` |
| `createDebtPayment(data)`        | Cria `payment`; se checkbox marcado, insere em `incomes` com `source = "${person.name} — ${description}"` e salva `incomeId` |
| `deleteDebtEntry({ id, alsoDeleteIncome? })` | Remove lançamento; se `alsoDeleteIncome: true`, remove também a linha em `incomes` vinculada |

### Ordem obrigatória em toda action com mutação

```
requireUserId() → schema.parse(data) → assertOwns* → query
```

### Regras de segurança

- Toda action chama `requireUserId()` de `@/lib/auth/require-user`.
- Toda operação filtra por `userId`.
- Ao referenciar `personId`, chamar `assertOwnsPerson(userId, personId)`.
- Ao referenciar um lançamento existente (edição, exclusão), chamar `assertOwnsDebtEntry(userId, entryId)`.
- Ao referenciar `sourceTransactionId`, validar que a transação pertence ao usuário via filtro `userId` na query.
- `assertOwnsPerson` e `assertOwnsDebtEntry` devem ser adicionados a `lib/auth/ownership.ts` seguindo o padrão existente.

### Comportamento de `incomeId` nulo

Quando um `payment` cria um `income`, o `incomeId` é salvo. Se o usuário deletar aquela entrada diretamente em `/registro` ou no dashboard, o banco aplica `onDelete: set null` — o `payment` permanece no histórico de devedores com `incomeId = null`.

Esse é um edge case aceito na v1: o saldo do devedor não é afetado, apenas a entrada some do caixa. Não tratar agora para não acoplar os módulos. Se houver relato real, avaliar na v1.1.

O fluxo inverso — excluir o `payment` em devedores sem limpar o `income` — é tratado na Fase 7 via flag `alsoDeleteIncome`.

### Revalidações

| Situação                                        | Paths                                                      |
| ----------------------------------------------- | ---------------------------------------------------------- |
| Mutação em pessoa                               | `/devedores`                                               |
| Mutação em lançamento                           | `/devedores`, `/devedores/[id]`                            |
| Pagamento que cria `income`                     | `/devedores`, `/devedores/[id]`, `/dashboard`, `/panorama` |
| Exclusão de pagamento com `alsoDeleteIncome: true` | `/devedores`, `/devedores/[id]`, `/dashboard`, `/panorama` |

## Arquivos Criados

| Arquivo                         |
| ------------------------------- |
| `lib/validations/debtors.ts`    |
| `lib/queries/debtors.ts`        |
| `lib/actions/debtors.ts`        |
