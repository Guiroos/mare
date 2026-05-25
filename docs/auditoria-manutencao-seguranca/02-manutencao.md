# Achados de Manutenção

## M1. Build executa migration do banco ✅ Resolvido (2026-05-10)

Severidade: alta operacional

Arquivo:

- `package.json`

Evidência:

```json
"build": "drizzle-kit migrate && next build"
```

Risco:

- Build passa a ter efeito colateral no banco.
- Deploy pode aplicar migration sem etapa de aprovação.
- Rollback fica mais difícil.
- Ambientes de preview podem atingir banco real se `DATABASE_URL` estiver errado.

Solução aplicada:

- `package.json`: `build` alterado para apenas `next build`.
- `vercel.json` criado com `buildCommand: "npm run db:migrate && npm run build"` — a
  Vercel usa esse campo no deploy, mantendo o comportamento de migration automática em
  produção sem afetar builds locais.

---

## M2. Falta de constraints únicas para dados mensais ✅ Resolvido (2026-05-10)

Severidade: média/alta

Arquivos afetados:

- `lib/db/schema.ts`
- `lib/actions/categories.ts`
- `lib/actions/investments.ts`

Casos observados:

- `monthlyBudgetOverrides` deveria provavelmente ser único por
  `(userId, categoryId, referenceMonth)`.
- `investments` deveria provavelmente ser único por
  `(userId, investmentTypeId, referenceMonth)`, se a intenção for um registro
  mensal por tipo.

Risco:

- Reenvio de formulário, concorrência ou bug de UI pode criar duplicatas.
- Totais do dashboard e panorama podem ficar inflados.
- O nome `upsert` nas actions sugere unicidade, mas o banco não garante.

Recomendação:

- Adicionar unique indexes.
- Usar `onConflictDoUpdate` para upserts reais.
- Criar rotina de saneamento para duplicatas existentes antes da migration.

Solução aplicada:

- Adicionados `uniqueIndex` em `investments(userId, investmentTypeId, referenceMonth)` e
  `monthlyBudgetOverrides(userId, categoryId, referenceMonth)` no schema Drizzle.
- `upsertBudgetOverride` e `upsertInvestment` reescritos para usar `onConflictDoUpdate`;
  parâmetro `existingId` removido do contrato público das duas funções — o banco resolve o
  conflito pela chave natural, sem depender do cliente informar se o registro existe.
- `assertOwnsCategory` / `assertOwnsInvestmentType` passam a rodar sempre (antes eram
  pulados no branch de update via `existingId`).
- Migration `0006_same_lake.sql` inclui `DELETE ... WHERE id NOT IN (DISTINCT ON ...)` antes
  dos `CREATE UNIQUE INDEX` para garantir idempotência em dados existentes.

---

## M3. Poucos índices compostos para queries centrais ✅ Resolvido (2026-05-10)

Severidade: média

Arquivos afetados:

- `lib/db/schema.ts`
- `lib/queries/dashboard.ts`
- `lib/queries/panorama.ts`
- `lib/queries/parcelas.ts`

Solução aplicada:

- Adicionados 8 índices compostos no schema via `index()` do Drizzle (migration
  `0005_ambitious_scarlet_witch.sql`):
  - `transactions(user_id, reference_month)`
  - `transactions(user_id, date)`
  - `fixed_expenses(user_id, reference_month)`
  - `incomes(user_id, reference_month)`
  - `investments(user_id, reference_month)`
  - `investments(user_id, investment_type_id)`
  - `investment_withdrawals(user_id, investment_type_id)`
  - `monthly_budget_overrides(user_id, reference_month)`

---

## M4. Duplicação de `requireUserId` ✅ Resolvido (2026-05-10)

Severidade: baixa/média

Arquivos afetados:

- `lib/actions/transactions.ts`
- `lib/actions/categories.ts`
- `lib/actions/investments.ts`
- `lib/actions/incomes.ts`
- `lib/actions/goals.ts`
- `lib/actions/feedback.ts`
- `lib/actions/form-data.ts`

Observação:

- Cada arquivo replicava a função `requireUserId`.

Solução aplicada:

- Criado `lib/auth/require-user.ts` com `requireUserId()` assíncrono que chama `auth()`
  internamente e retorna o `userId`.
- Todas as copies locais removidas dos arquivos de action.
- Padrão nas actions: `const userId = await requireUserId()` sem importar `auth`
  diretamente.

---

## M5. Tipagem do `session.user.id` depende de casts ✅ Resolvido (2026-05-10)

Severidade: baixa/média

Arquivos afetados:

- `lib/auth.ts`
- vários arquivos que usam `(session.user as { id?: string }).id`

Solução aplicada:

- Criado `types/next-auth.d.ts` com module augmentation que adiciona `id: string` ao
  `Session.user` do NextAuth v4.
- Removidos todos os casts em 8 páginas e no próprio `lib/auth.ts`.
- `session.user.id` agora é tipado diretamente sem `as`.

---

## M6. Consultas de investimento têm padrão N+1

Severidade: média futura

Arquivo:

- `lib/queries/investments.ts`

Evidência:

- `getInvestmentBalances` busca todos os tipos e, para cada tipo, executa três
  operações em paralelo.

Risco:

- Com muitos tipos de investimento, a quantidade de queries cresce linearmente.

Recomendação:

- Seguir o padrão já usado em `dashboard.ts` e `goals.ts`: bulk queries com
  `GROUP BY` e mapas em memória.

---

## M7. Ausência de testes automatizados do projeto

Severidade: média

Evidência:

- Não há testes do projeto encontrados.
- `CLAUDE.md` também registra que não há testes automatizados.
- `npm run lint` e `npm run typecheck` passam, mas não substituem testes de
  comportamento.

Recomendação:

- Começar com testes de actions/queries críticas:
  - isolamento entre usuários;
  - validação de IDs relacionados;
  - upserts mensais;
  - cálculos de dashboard;
  - resgate que cria entrada;
  - cópia de gastos fixos e overrides.

---

## M8. Documento README está um pouco defasado

Severidade: baixa

Arquivo:

- `README.md`

Observações:

- README lista `/categorias` como gerenciamento de categorias e contas, mas existe
  rota dedicada `/contas`.
- README não lista `/admin`.
- `.env.example` inclui `ADMIN_EMAIL`, mas o bloco principal do README não mostra.

Recomendação:

- Atualizar README para refletir rotas atuais e variáveis de ambiente atuais.

---

## Code Smells Observados

### CS1. Actions confiam em tipos TypeScript como contrato de segurança

Tipos como `CreateTransactionInput`, `CreateFixedExpenseInput` e
`UpsertInvestmentInput` ajudam o desenvolvimento, mas não validam chamadas em
runtime.

Recomendação:

- Treat server actions as public boundary.
- Toda action deve começar com:
  - `auth()`;
  - parse do schema server-side;
  - validação de ownership;
  - mutação.

### CS2. Upserts sem transação explícita

Algumas operações fazem múltiplas alterações relacionadas:

- criar compra parcelada: grupo + várias transações;
- atualizar grupo parcelado: grupo + transações filhas;
- criar resgate: opcionalmente income + withdrawal;
- deletar resgate: withdrawal + income;
- copiar gastos fixos: delete + insert;
- copiar overrides: delete + insert.

Recomendação:

- Avaliar suporte transacional no driver usado.
- Onde não houver transação, pelo menos tornar operações idempotentes e
  recuperáveis.

### CS3. Strings de domínio sem enum no banco

Exemplos:

- `payment_accounts.type`
- `investment_withdrawals.destination`
- `goal_contributions.source`
- `feedback.category`
- `feedback.status`

Recomendação:

- Usar enum Drizzle/Postgres ou constraints `CHECK`.
- Manter Zod e banco alinhados.

### CS4. Datas e valores monetários são strings em muitos limites

O projeto usa `date` e `decimal` no banco, mas os limites entre UI/action usam
strings.

Recomendação:

- Centralizar parsers de dinheiro e data.
- Usar helpers para converter de input de UI para payload validado.
- Evitar `parseFloat` para divisão de parcelas; preferir centavos inteiros para
  evitar problemas de arredondamento. O update de parcelas já faz isso melhor que
  a criação.

---

## Pontos Positivos Preserváveis

1. Separação clara entre `actions`, `queries`, `validations`, `components` e
   `db/schema`.
2. Uso consistente de `revalidatePath` após mutações.
3. Helpers de data centralizados em `lib/utils/date.ts`.
4. Conversão monetária centralizada parcialmente em `toAmount`.
5. Otimizações já documentadas para dashboard e panorama, evitando N x queries.
6. UI com design system próprio em `components/ui`.
7. Admin protegido tanto na página quanto na action de status.
8. `.gitignore` protege `.env.local`, `.env` e arquivos sensíveis comuns.
