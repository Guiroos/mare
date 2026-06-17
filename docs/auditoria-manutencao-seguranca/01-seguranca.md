# Achados de Segurança

## S1. IDs relacionados não são validados contra o dono ✅ Resolvido (2026-05-10)

Severidade: alta

Arquivos afetados:

- `lib/actions/transactions.ts`
- `lib/actions/categories.ts`
- `lib/actions/investments.ts`
- `lib/actions/goals.ts`
- `lib/db/schema.ts`
- `lib/queries/dashboard.ts`

Evidência:

- `createTransaction` grava `categoryId` e `accountId` vindos do cliente sem
  verificar se ambos pertencem ao `userId` autenticado.
- `createFixedExpense`, `updateFixedExpense`, `createInstallmentPurchase` e
  `updateTransaction` têm o mesmo padrão.
- `createCategory` e `updateCategory` aceitam `groupId` sem validar se o grupo
  pertence ao usuário.
- `upsertBudgetOverride` aceita `categoryId` sem validar ownership.
- `upsertInvestment`, `createWithdrawal` e `updateWithdrawal` aceitam
  `investmentTypeId` sem validar ownership.
- `upsertGoal` aceita `investmentTypeId` sem validar ownership.
- `addGoalContribution` aceita `goalId` sem validar ownership.

Risco:

- Um usuário autenticado que descubra um UUID válido de outro usuário pode tentar
  vincular seus registros a categorias, contas, grupos, metas ou tipos de
  investimento que não são dele.
- Como queries usam relations, isso pode revelar metadados como nome de categoria,
  nome de conta ou nome de tipo de investimento.
- Mesmo quando não houver vazamento visual, os dados ficam semanticamente
  corrompidos.

Recomendação:

- Criar helpers centralizados de autorização de domínio:
  - `assertOwnsCategory(userId, categoryId)`
  - `assertOwnsCategoryGroup(userId, groupId)`
  - `assertOwnsPaymentAccount(userId, accountId)`
  - `assertOwnsInvestmentType(userId, investmentTypeId)`
  - `assertOwnsGoal(userId, goalId)`
  - `assertOwnsBudgetOverride(userId, overrideId)`
- Chamar esses helpers antes de qualquer insert/update que referencie outro ID.
- Para updates, validar tanto o registro alterado quanto os novos IDs
  relacionados.
- Avaliar constraints compostas no banco quando aplicável, por exemplo
  `(id, user_id)` referenciado por tabelas filhas. Isso aumenta proteção mesmo
  se uma action futura esquecer a validação.

Solução aplicada:

- Criado `lib/auth/ownership.ts` com helpers `assertOwnsCategory`, `assertOwnsCategoryGroup`,
  `assertOwnsPaymentAccount`, `assertOwnsInvestmentType` e `assertOwnsGoal`.
- Cada helper faz SELECT mínimo com `limit(1)` e lança `'Não autorizado'` se o registro
  não pertencer ao userId.
- Checks aplicados em todas as actions afetadas (`transactions.ts`, `categories.ts`,
  `investments.ts`, `goals.ts`) com `Promise.all` quando há múltiplos checks independentes
  ou quando a action já realizava um SELECT que pode ser paralelizado.

---

## S2. Validação server-side é insuficiente nas server actions ✅ Resolvido (2026-05-10)

Severidade: alta

Arquivos afetados:

- `lib/actions/*.ts`
- `lib/validations/*.ts`
- componentes client-side que chamam actions

Evidência:

- Os schemas Zod são usados principalmente nos componentes client-side.
- As server actions aceitam objetos tipados, mas tipos TypeScript não protegem em
  runtime.
- Os schemas verificam principalmente presença de string, por exemplo
  `amount: z.string().min(1)`, `date: z.string().min(1)` e `categoryId:
z.string().min(1)`.

Risco:

- Actions podem receber chamadas diretas com payloads inválidos, negativos,
  datas malformadas, strings enormes ou UUIDs inválidos.
- Campos monetários podem aceitar formatos inesperados até o banco rejeitar, ou
  aceitar valores semanticamente ruins.
- Erros do banco podem vazar como falhas genéricas e dificultar diagnóstico.

Recomendação:

- Fazer parse Zod dentro de cada action.
- Trocar validações superficiais por validações de domínio:
  - UUID válido para IDs;
  - moeda positiva quando aplicável;
  - datas `YYYY-MM-DD` válidas;
  - mês de referência `YYYY-MM-01`;
  - limites de tamanho alinhados ao schema;
  - enums reais para tipos e status;
  - `closingDay` permitido apenas para conta de crédito;
  - `amount > 0` para receitas, despesas, aportes e pagamentos;
  - regras específicas para adjustment quando o domínio de devedores for criado.
- Retornar erros controlados de validação em vez de depender de exceções do banco.

Solução aplicada:

- Adicionados primitivos reutilizáveis em `lib/validations/utils.ts`: `uuidSchema`, `positiveAmountSchema`,
  `nonNegativeAmountSchema`, `optionalPositiveAmountSchema`, `nullishNonNegativeAmountSchema`,
  `dateSchema`, `referenceMonthSchema`.
- Schemas de formulário existentes fortalecidos: IDs validados como UUID, amounts como positivo/não-negativo
  conforme domínio (investimentos aceitam 0), datas validadas em formato `YYYY-MM-DD`, meses de referência
  em `YYYY-MM-01`, nomes com `.max(N)` alinhado ao schema do banco.
- Schemas server-side criados para actions com tipos diferentes do formulário (ex: `dueDay: number`,
  `totalInstallments: number`): `createFixedExpenseActionSchema`, `updateFixedExpenseActionSchema`,
  `createInstallmentActionSchema`, `updateInstallmentGroupActionSchema`, `accountActionSchema`,
  `upsertGoalActionSchema`, `addContributionActionSchema`, `updateContributionActionSchema`,
  `updateWithdrawalActionSchema`, `updateTransactionActionSchema`, `updateIncomeActionSchema`.
- Todas as actions chamam `schema.parse(data)` como primeira linha após `requireUserId()`, antes de
  qualquer ownership check ou query.
- `lib/actions/form-data.ts` corrigido: removida `requireUserId` local que havia ficado de fora do M4.
- `lib/actions/feedback.ts`: adicionado schema inline com enum para `category` e limites em `message`/`page`.

---

## S3. Vulnerabilidades em dependências ✅ Parcialmente resolvido (2026-05-24)

Severidade original: alta

**Estado em 2026-05-10 (análise original):**

- 13 vulnerabilidades: 8 altas + 5 moderadas.
- Pacotes: `next@14.2.35`, `@ducanh2912/next-pwa`, `drizzle-kit` (via `esbuild`),
  `fast-uri`, `serialize-javascript`, `@babel/plugin-transform-modules-systemjs`, `postcss`.
- Riscos: DoS/request smuggling em Next.js, RCE em `serialize-javascript`, path traversal em `fast-uri`.

**Estado atual (2026-05-25):**

- 11 vulnerabilidades moderadas; **zero altas**.
- Upgrade para Next.js 16.2.6 eliminou os CVEs do Next.js 14.
- Migração de `@ducanh2912/next-pwa` para `@serwist/next` eliminou a cadeia de CVEs do PWA.
- Vulnerabilidades residuais:
  - `esbuild <=0.24.2` via `drizzle-kit` — afeta apenas servidor de dev do drizzle-kit; sem exposição em produção.
  - `postcss <8.5.10` dentro da árvore do Next.js — XSS em stringify CSS; fix requer `npm audit fix --force` com breaking change em `@vercel/speed-insights`.
  - `brace-expansion 5.0.2–5.0.5` via `@typescript-eslint` — DoS em range numérico; fix disponível sem breaking change via `npm audit fix`.

Pendências:

- Avaliar `npm audit fix` para `brace-expansion` (safe fix).
- Acompanhar Next.js patchando `postcss` internamente.
- `esbuild` em `drizzle-kit`: risco aceito — tooling dev, sem exposição de produção.

---

## S4. Autenticação depende de configuração correta

Severidade: baixa

Arquivos afetados:

- `lib/auth.ts`
- `.env.example`
- `README.md`

Observações:

- Cadastro aberto: qualquer conta Google válida pode criar uma conta no app.
- O provider `dev` só autoriza em `NODE_ENV=development`.
- `NEXTAUTH_SECRET` é obrigatório e documentado, mas não há validação explícita
  de configuração na inicialização.

Risco:

- Deploy com variáveis ausentes pode quebrar login de forma pouco clara.

Recomendação:

- Criar módulo `lib/env.ts` com validação das variáveis obrigatórias.

---

## S5. Tokens OAuth são persistidos na tabela de contas

Severidade: média

Arquivo:

- `lib/db/schema.ts`

Evidência:

- A tabela `accounts` contém `refreshToken`, `accessToken` e `idToken`.

Contexto:

- Isso é padrão em adapters OAuth, mas aumenta criticidade do banco.

Recomendação:

- Garantir que o banco Neon use TLS e credenciais fortes.
- Restringir acesso ao banco em ambientes de produção.
- Evitar logs de rows da tabela `accounts`.
- Considerar criptografia de tokens em repouso se o risco do ambiente justificar.

---

## S6. PWA e cache merecem revisão de privacidade

Severidade: média

Arquivo:

- `next.config.mjs`

Evidência:

- PWA habilitado fora de desenvolvimento.
- `cacheOnFrontEndNav: true`.
- `aggressiveFrontEndNavCaching: false`.

Risco:

- Em app financeiro, cache offline ou service worker mal configurado pode manter
  dados sensíveis no dispositivo por mais tempo que o usuário espera.

Recomendação:

- Revisar estratégia de cache do PWA especificamente para dados financeiros.
- Evitar cache de respostas autenticadas sensíveis.
- Testar logout com service worker ativo.
- Considerar política clara de limpeza de cache no logout.
