# Auditoria de manutenção e segurança

Data da análise: 2026-05-10

## Objetivo

Registrar a leitura técnica do projeto Maré, seus domínios atuais, o significado do
produto e os pontos observados para futuras melhorias com foco em manutenção,
segurança, qualidade operacional e evolução do código.

Esta análise não altera a aplicação. Ela consolida evidências vistas no código,
comandos executados e recomendações priorizadas.

## Resumo executivo

O Maré é um aplicativo de finanças pessoais construído com Next.js App Router,
NextAuth, Drizzle ORM e Neon/PostgreSQL. O modelo central é o controle financeiro
por usuário e por mês de referência, sempre no formato `YYYY-MM-01`.

A base está organizada e já segue boas práticas importantes:

- rotas autenticadas sob `app/(app)`;
- server actions para mutações;
- queries server-side separadas por domínio;
- uso consistente de `userId` em grande parte das leituras e mutações;
- whitelist de emails no login;
- rota administrativa protegida por `ADMIN_EMAIL`;
- ausência de padrões óbvios de XSS manual como `dangerouslySetInnerHTML` ou `eval`.

Os principais riscos encontrados estão em quatro frentes:

1. Validação insuficiente de IDs relacionados enviados pelo cliente.
2. Validação server-side fraca nas server actions.
3. Dependências com vulnerabilidades conhecidas no `npm audit`.
4. Operação de banco acoplada ao script de build.

## Significado do projeto

O Maré é um sistema pessoal de acompanhamento financeiro. O produto não é apenas
um CRUD de transações: ele organiza o fluxo financeiro em torno de orçamento,
categorias, contas, compromissos recorrentes, parcelamentos, investimentos,
metas e visão histórica.

O conceito mais importante do domínio é o mês de referência. A maioria dos dados
financeiros é analisada e exibida por mês, e o projeto documenta que o mês deve
ser persistido como `YYYY-MM-01`.

O nome Maré combina com a proposta: acompanhar entradas, saídas, ciclos, saldos e
evolução patrimonial como movimentos recorrentes ao longo do tempo.

## Domínios atuais

### Autenticação e usuários

Arquivos principais:

- `lib/auth.ts`
- `app/api/auth/[...nextauth]/route.ts`
- `app/(auth)/login/page.tsx`
- `app/(app)/layout.tsx`
- tabelas `users`, `accounts`, `sessions`, `verification_tokens`

Responsabilidades:

- login com Google OAuth via NextAuth;
- login local de desenvolvimento via `CredentialsProvider` apenas em
  `NODE_ENV=development`;
- estratégia de sessão JWT;
- preenchimento de `session.user.id` a partir de `token.sub`;
- criação de categorias padrão no evento `createUser`;
- bloqueio de emails fora de `ALLOWED_EMAILS`;
- proteção do layout autenticado com redirect para `/login`.

Observações:

- O provider `dev` retorna `null` fora de desenvolvimento, o que reduz o risco
  de login local em produção.
- Se `ALLOWED_EMAILS` estiver vazio em produção, todo login Google será bloqueado.
  Isso é seguro por padrão, mas precisa estar bem documentado para deploy.

### Categorias, grupos e orçamento

Arquivos principais:

- `lib/actions/categories.ts`
- `lib/queries/categories.ts`
- `lib/validations/categories.ts`
- `app/(app)/categorias/page.tsx`
- `app/(app)/configuracao-mes/page.tsx`
- tabelas `category_groups`, `categories`, `monthly_budget_overrides`

Responsabilidades:

- criar, editar, remover e reordenar grupos de categoria;
- criar, editar e remover categorias;
- configurar orçamento padrão por categoria;
- configurar override mensal de orçamento;
- copiar overrides do mês anterior.

Ponto de domínio:

- O orçamento efetivo de uma categoria é o `defaultBudget`, exceto quando existe
  `monthlyBudgetOverride` para o mês.

### Contas de pagamento

Arquivos principais:

- `lib/actions/categories.ts`
- `lib/queries/categories.ts`
- `components/contas/AccountDialog.tsx`
- `app/(app)/contas/page.tsx`
- tabela `payment_accounts`

Responsabilidades:

- cadastrar contas do tipo `credit`, `debit` e `pix`;
- armazenar `closingDay` para cartões de crédito;
- alimentar seleção de ciclo de cartão no dashboard.

Ponto de domínio:

- Quando `closingDay > 1`, o dashboard pode filtrar transações por ciclo de
  cobrança do cartão, não apenas por mês calendário.

### Transações, gastos fixos e parcelamentos

Arquivos principais:

- `lib/actions/transactions.ts`
- `lib/queries/dashboard.ts`
- `lib/queries/parcelas.ts`
- `lib/validations/transactions.ts`
- `components/forms/TransactionForm.tsx`
- tabelas `transactions`, `fixed_expenses`, `installment_groups`

Responsabilidades:

- registrar saídas avulsas;
- registrar gastos fixos mensais;
- copiar gastos fixos do mês anterior;
- criar compra parcelada com um grupo e N transações futuras;
- editar e excluir transações, gastos fixos e grupos de parcelas.

Ponto de domínio:

- Uma compra parcelada cria uma linha em `installment_groups` e várias linhas em
  `transactions`, uma por mês.

### Entradas

Arquivos principais:

- `lib/actions/incomes.ts`
- `lib/queries/dashboard.ts`
- tabela `incomes`

Responsabilidades:

- registrar entradas mensais;
- editar e remover entradas;
- alimentar dashboard e panorama anual.

Ponto de domínio:

- Entradas não têm categoria. As categorias são exclusivas de despesas.

### Investimentos e resgates

Arquivos principais:

- `lib/actions/investments.ts`
- `lib/queries/investments.ts`
- `lib/validations/investments.ts`
- `app/(app)/investimentos/page.tsx`
- tabelas `investment_types`, `investments`, `investment_withdrawals`

Responsabilidades:

- criar tipos de investimento;
- registrar aportes, rendimentos e observações por mês;
- excluir investimentos;
- registrar resgates;
- opcionalmente transformar resgate em entrada;
- calcular patrimônio e histórico.

Ponto de domínio:

- `excludeFromCashFlow` permite que um investimento fique fora do cálculo de fluxo
  de caixa do dashboard.

### Metas financeiras

Arquivos principais:

- `lib/actions/goals.ts`
- `lib/queries/goals.ts`
- `lib/validations/goals.ts`
- `app/(app)/metas/page.tsx`
- tabelas `goals`, `goal_contributions`

Responsabilidades:

- criar metas;
- associar uma meta opcionalmente a um tipo de investimento;
- registrar contribuições manuais;
- calcular progresso e projeção.

Ponto de domínio:

- Uma meta pode calcular saldo por contribuições manuais ou por vínculo com tipo
  de investimento.

### Dashboard mensal

Arquivos principais:

- `app/(app)/dashboard/page.tsx`
- `lib/queries/dashboard.ts`
- componentes em `components/dashboard/`

Responsabilidades:

- mostrar resumo mensal;
- listar transações, gastos fixos, entradas e investimentos;
- calcular evolução mensal;
- exibir progresso de categorias;
- suportar filtro por ciclo de cartão.

Ponto de manutenção positivo:

- `getMonthlyEvolution` evita padrão N x 4 queries e usa consultas agregadas por
  `IN + GROUP BY`.

### Panorama anual

Arquivos principais:

- `app/(app)/panorama/page.tsx`
- `lib/queries/panorama.ts`
- componentes em `components/charts/`

Responsabilidades:

- consolidar visão anual de entradas, despesas, investimentos e saldo;
- agrupar gastos anuais por grupos de categoria.

### Feedback e administração

Arquivos principais:

- `lib/actions/feedback.ts`
- `lib/actions/admin.ts`
- `lib/queries/admin.ts`
- `app/(app)/admin/page.tsx`
- tabela `feedback`

Responsabilidades:

- permitir que usuários enviem feedback;
- permitir que admin veja estatísticas e todos os feedbacks;
- permitir alterar status de feedback.

Observações:

- A página admin valida `ADMIN_EMAIL` antes de chamar queries globais.
- A action de alteração de status também valida `ADMIN_EMAIL`.

### Domínio futuro: devedores

Arquivo:

- `docs/techspec-devedores.md`

Status:

- Documento não versionado no momento da análise.
- Não é funcionalidade implementada ainda.

Resumo:

- Propõe criar um domínio próprio de contas a receber, separado de
  `transactions`.
- A decisão arquitetural está correta: dívida de outra pessoa não deve ser
  automaticamente tratada como gasto do usuário nem afetar orçamento.
- O próprio documento já registra regras importantes de segurança: toda action
  deve chamar `auth()`, filtrar por `userId` e validar que pessoa, transação e
  entrada referenciadas pertencem ao usuário.

## Achados de segurança

### S1. IDs relacionados não são validados contra o dono ✅ Resolvido (2026-05-10)

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

### S2. Validação server-side é insuficiente nas server actions ✅ Resolvido (2026-05-10)

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

### S3. Vulnerabilidades em dependências

Severidade: alta

Comando executado:

```bash
npm audit --audit-level=moderate
```

Resultado:

- 13 vulnerabilidades encontradas.
- 8 de severidade alta.
- 5 de severidade moderada.

Pacotes mencionados no audit:

- `next@14.2.35`
- `@ducanh2912/next-pwa`
- `drizzle-kit` por cadeia com `@esbuild-kit/esm-loader` e `esbuild`
- `fast-uri`
- `serialize-javascript`
- `@babel/plugin-transform-modules-systemjs`
- `postcss` dentro da árvore de `next`

Riscos destacados pelo audit:

- DoS em Next.js;
- request smuggling em Next.js;
- crescimento não limitado de cache de imagem em Next.js;
- vulnerabilidade de servidor dev em `esbuild`;
- path traversal/host confusion em `fast-uri`;
- RCE/DoS em `serialize-javascript`.

Observação:

- O audit indicou `npm audit fix --force` para alguns itens, mas isso pode
  introduzir mudanças quebráveis, incluindo salto para Next 16 e alteração de
  pacotes ligados ao PWA. Não aplicar automaticamente sem plano de upgrade.

Recomendação:

- Separar em dois tracks:
  - produção: atualizar Next e pacotes runtime com validação de build;
  - desenvolvimento: atualizar ou isolar vulnerabilidades de tooling como
    `drizzle-kit`/`esbuild`.
- Revisar se PWA é essencial neste momento. Se não for, considerar remover ou
  desativar temporariamente `@ducanh2912/next-pwa` até haver versão segura.
- Rodar `npm audit` novamente após upgrades e registrar decisão para itens
  residuais.

### S4. Autenticação depende de configuração correta

Severidade: média

Arquivos afetados:

- `lib/auth.ts`
- `.env.example`
- `README.md`

Observações:

- O login Google é bloqueado quando email não está em `ALLOWED_EMAILS`.
- O provider `dev` só autoriza em `NODE_ENV=development`.
- `NEXTAUTH_SECRET` é obrigatório e documentado, mas não há validação explícita
  de configuração na inicialização.

Risco:

- Deploy com variáveis ausentes pode quebrar login de forma pouco clara.
- `ALLOWED_EMAILS` com espaços, caixa diferente ou email não normalizado pode
  causar bloqueios inesperados.

Recomendação:

- Criar módulo `lib/env.ts` com validação das variáveis obrigatórias.
- Normalizar emails para lowercase tanto em `ALLOWED_EMAILS` quanto no email do
  usuário.
- Documentar que `ADMIN_EMAIL` também deve estar contido em `ALLOWED_EMAILS`.

### S5. Tokens OAuth são persistidos na tabela de contas

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

### S6. PWA e cache merecem revisão de privacidade

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

## Achados de manutenção

### M1. Build executa migration do banco ✅ Resolvido (2026-05-10)

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

### M2. Falta de constraints únicas para dados mensais ✅ Resolvido (2026-05-10)

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

### M3. Poucos índices compostos para queries centrais ✅ Resolvido (2026-05-10)

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

### M4. Duplicação de `requireUserId` ✅ Resolvido (2026-05-10)

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

- Cada arquivo replica a função `requireUserId`.

Solução aplicada:

- Criado `lib/auth/require-user.ts` com `requireUserId()` assíncrono que chama `auth()`
  internamente e retorna o `userId`.
- Todas as copies locais removidas dos arquivos de action.
- Padrão nas actions: `const userId = await requireUserId()` sem importar `auth`
  diretamente.

### M5. Tipagem do `session.user.id` depende de casts ✅ Resolvido (2026-05-10)

Severidade: baixa/média

Arquivos afetados:

- `lib/auth.ts`
- vários arquivos que usam `(session.user as { id?: string }).id`

Solução aplicada:

- Criado `types/next-auth.d.ts` com module augmentation que adiciona `id: string` ao
  `Session.user` do NextAuth v4.
- Removidos todos os casts em 8 páginas e no próprio `lib/auth.ts`.
- `session.user.id` agora é tipado diretamente sem `as`.

### M6. Consultas de investimento têm padrão N+1

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

### M7. Ausência de testes automatizados do projeto

Severidade: média

Evidência:

- Não há testes do projeto encontrados.
- `CLAUDE.md` também registra que não há testes automatizados.
- `npm run lint` e `npm run build:check` passam, mas não substituem testes de
  comportamento.

Recomendação:

- Começar com testes de actions/queries críticas:
  - isolamento entre usuários;
  - validação de IDs relacionados;
  - upserts mensais;
  - cálculos de dashboard;
  - resgate que cria entrada;
  - cópia de gastos fixos e overrides.

### M8. Documento README está um pouco defasado

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

## Code smells observados

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

## Pontos positivos preserváveis

1. Separação clara entre `actions`, `queries`, `validations`, `components` e
   `db/schema`.
2. Uso consistente de `revalidatePath` após mutações.
3. Helpers de data centralizados em `lib/utils/date.ts`.
4. Conversão monetária centralizada parcialmente em `toAmount`.
5. Otimizações já documentadas para dashboard e panorama, evitando N x queries.
6. UI com design system próprio em `components/ui`.
7. Admin protegido tanto na página quanto na action de status.
8. `.gitignore` protege `.env.local`, `.env` e arquivos sensíveis comuns.

## Comandos executados

### Estrutura e busca

```bash
rg --files -g '!*node_modules*' -g '!*.png' -g '!*.jpg' -g '!*.jpeg' -g '!*.gif' -g '!*.webp'
git status --short --branch
rg -n "auth|login|password|token|jwt|secret|DATABASE|API|TODO|FIXME|eslint-disable|dangerouslySetInnerHTML|eval\\(|innerHTML|localStorage|sessionStorage|process\\.env" .
```

### Leitura de arquivos principais

Foram analisados:

- `README.md`
- `CLAUDE.md`
- `package.json`
- `next.config.mjs`
- `lib/auth.ts`
- `lib/db/schema.ts`
- `lib/db/index.ts`
- `drizzle.config.ts`
- `lib/actions/*.ts`
- `lib/queries/*.ts`
- `lib/validations/*.ts`
- `components/forms/TransactionForm.tsx`
- `app/(app)/layout.tsx`
- `app/(app)/admin/page.tsx`
- `.gitignore`
- `.env.example`
- `docs/techspec-devedores.md`

### Verificações

```bash
npm run lint
npm run build:check
npm audit --audit-level=moderate
```

Resultados:

- `npm run lint`: passou.
- `npm run build:check`: passou.
- `npm audit --audit-level=moderate`: falhou primeiro por restrição/rede no
  sandbox; depois rodou com acesso de rede e encontrou 13 vulnerabilidades.

Observação:

- `npm run build` não foi executado porque o script atual aplica migrations antes
  de compilar.

## Plano de melhoria sugerido

### Fase 1: Segurança de domínio ✅ Concluída (2026-05-10)

Objetivo:

- impedir vínculo cruzado de dados entre usuários.

Tarefas:

- ✅ criar helpers de ownership (`lib/auth/ownership.ts`);
- ✅ validar `categoryId`, `accountId`, `groupId`, `investmentTypeId` e `goalId`;
- ✅ aplicar validação nas actions de transações, categorias, investimentos e metas;
- adicionar testes de usuário A tentando referenciar ID do usuário B.

### Fase 2: Validação server-side ✅ Concluída (2026-05-10)

Objetivo:

- tornar server actions uma fronteira segura.

Tarefas:

- ✅ mover ou reutilizar schemas Zod dentro das actions;
- ✅ fortalecer schemas com UUID, moeda, datas, enums e limites;
- cobrir casos inválidos com testes.

### Fase 3: Dependências e build

Objetivo:

- reduzir exposição a CVEs e separar build de banco.

Tarefas:

- remover `drizzle-kit migrate` do `npm run build`;
- criar etapa explícita de migration;
- planejar upgrade de Next;
- revisar `@ducanh2912/next-pwa` e Workbox;
- rodar `npm audit` depois de cada alteração.

### Fase 4: Integridade do banco ✅ Parcialmente concluída (2026-05-10)

Objetivo:

- fazer o banco proteger invariantes do domínio.

Tarefas:

- ✅ adicionar unique indexes para registros mensais únicos;
- ✅ adicionar índices compostos para queries por usuário/mês (M3);
- avaliar enums ou checks para strings de domínio;
- ✅ migration de limpeza incluída na 0006_same_lake.sql.

### Fase 5: Observabilidade e testes

Objetivo:

- reduzir regressões futuras.

Tarefas:

- introduzir testes para actions e queries críticas;
- criar seed de teste com dois usuários;
- testar isolamento multiusuário;
- testar cálculos do dashboard e panorama;
- documentar decisões operacionais de deploy.

## Checklist rápido para próximos PRs

- Toda action chama `auth()` e exige `userId`.
- Toda action valida payload no servidor com Zod.
- Todo ID relacionado é checado por ownership.
- Toda mutação multi-step é transacional ou idempotente.
- Todo dado mensal que deveria ser único tem unique index.
- Toda query frequente por `userId + referenceMonth` tem índice.
- Nenhuma migration roda implicitamente em `npm run build`.
- `npm audit` é revisado antes de release.
- Novos domínios seguem o padrão de isolamento por usuário desde a primeira fase.
