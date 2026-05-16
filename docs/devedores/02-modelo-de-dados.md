# Devedores — Modelo de Dados

## Tabela `people`

Representa pessoas cadastradas pelo usuário.

| Campo       | Tipo          | Obrigatório | Notas                                    |
| ----------- | ------------- | ----------- | ---------------------------------------- |
| `id`        | uuid          | sim         | primary key                              |
| `userId`    | uuid          | sim         | referencia `users.id`, cascade delete    |
| `name`      | varchar(200)  | sim         |                                          |
| `email`     | varchar(255)  | não         |                                          |
| `phone`     | varchar(40)   | não         |                                          |
| `notes`     | text          | não         |                                          |
| `archived`  | boolean       | —           | default `false`                          |
| `createdAt` | timestamp     | —           | default now                              |
| `updatedAt` | timestamp     | —           | default now; atualizar manualmente nas actions de edição |

Regras:

- Não usar email ou telefone como identificador único.
- Permitir pessoas sem contato.
- Arquivar em vez de apagar quando houver histórico.

## Tabela `debtor_entries`

Representa o razão financeiro de cada pessoa.

| Campo                 | Tipo          | Obrigatório | Notas                                                        |
| --------------------- | ------------- | ----------- | ------------------------------------------------------------ |
| `id`                  | uuid          | sim         | primary key                                                  |
| `userId`              | uuid          | sim         | referencia `users.id`, cascade delete                        |
| `personId`            | uuid          | sim         | referencia `people.id`, cascade delete                       |
| `type`                | varchar(20)   | sim         | `charge` / `payment` / `adjustment`                          |
| `amount`              | decimal(10,2) | sim         |                                                              |
| `description`         | varchar(200)  | sim         |                                                              |
| `referenceMonth`      | date          | sim         | sempre `YYYY-MM-01`; em `charge`, derivado de `entryDate` na action; em `payment`, usa o mês passado pelo caller (define em qual mês a entrada aparece no dashboard) ou deriva de `entryDate` se `createIncome` for falso |
| `entryDate`           | date          | sim         | quando a dívida ou pagamento aconteceu                       |
| `dueDate`             | date          | não         | vencimento combinado; reservado para uso futuro — não exposto na UI da v1 |
| `sourceTransactionId` | uuid          | não         | referencia `transactions.id`, `onDelete: set null`; apenas em `charge` na v1 |
| `incomeId`            | uuid          | não         | referencia `incomes.id`, `onDelete: set null`; apenas em `payment` na v1 |
| `notes`               | text          | não         |                                                              |
| `createdAt`           | timestamp     | —           | default now                                                  |
| `updatedAt`           | timestamp     | —           | default now                                                  |

### Semântica dos tipos

| Tipo         | `amount` | Efeito no saldo | `entryDate` significa                          |
| ------------ | -------- | --------------- | ---------------------------------------------- |
| `charge`     | positivo | aumenta         | quando a pessoa passou a dever                 |
| `payment`    | positivo | reduz           | quando o usuário recebeu o pagamento           |
| `adjustment` | positivo | aumenta         | livre — usado para correções manuais de saldo; nunca negativo por tipo |

`adjustment` sempre soma ao saldo (mesmo comportamento de `charge`). Não há caso de uso de ajuste negativo na v1 — para reduzir saldo, usar `payment`.

### Regras de integridade

- Todo registro deve pertencer ao mesmo `userId` da pessoa.
- Se `sourceTransactionId` existir, a transação também precisa pertencer ao mesmo `userId`.
- Se `incomeId` existir, a entrada também precisa pertencer ao mesmo `userId`.
- Na primeira versão, `sourceTransactionId` só em lançamentos `charge`.
- Na primeira versão, `incomeId` só em lançamentos `payment`.

## Cálculo De Saldo

```
saldo = soma(charge.amount) - soma(payment.amount) + soma(adjustment.amount)
```

| Saldo    | Significado                                    |
| -------- | ---------------------------------------------- |
| > 0      | pessoa deve ao usuário                         |
| = 0      | pessoa quitada                                 |
| < 0      | pessoa pagou a mais ou houve ajuste excedente  |

## Índices

| Tabela           | Índice                              | Colunas                  | Motivo                                              |
| ---------------- | ----------------------------------- | ------------------------ | --------------------------------------------------- |
| `people`         | `people_user_idx`                   | `(userId)`               | filtro base de todas as queries                     |
| `debtor_entries` | `debtor_entries_user_person_idx`    | `(userId, personId)`     | `GROUP BY personId` de `getPeopleWithBalances`      |
| `debtor_entries` | `debtor_entries_user_month_idx`     | `(userId, referenceMonth)` | filtros futuros por mês de referência             |

Sintaxe Drizzle (terceiro parâmetro de `pgTable`):

```ts
(t) => [
  index('debtor_entries_user_person_idx').on(t.userId, t.personId),
  index('debtor_entries_user_month_idx').on(t.userId, t.referenceMonth),
]
```

## Arquivos Criados/Alterados

| Ação    | Arquivo                                           |
| ------- | ------------------------------------------------- |
| Alterado | `lib/db/schema.ts`                               |
| Gerado  | `lib/db/migrations/0008_lying_payback.sql`        |
| Gerado  | `lib/db/migrations/meta/0008_snapshot.json`       |
