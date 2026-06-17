# Auditoria de Manutenção e Segurança

Data da análise: 2026-05-10

## Objetivo

Registrar a leitura técnica do projeto Maré, seus domínios atuais, o significado do
produto e os pontos observados para futuras melhorias com foco em manutenção,
segurança, qualidade operacional e evolução do código.

Esta análise não altera a aplicação. Ela consolida evidências vistas no código,
comandos executados e recomendações priorizadas.

## Arquivos

| Arquivo                              | Conteúdo                                        |
| ------------------------------------ | ----------------------------------------------- |
| [01-seguranca.md](./01-seguranca.md) | Achados S1–S6 com severidade e soluções         |
| [02-manutencao.md](./02-manutencao.md) | Achados M1–M8, code smells e pontos positivos |
| [03-plano.md](./03-plano.md)         | Plano de melhoria por fase e checklist rápido   |

---

## Resumo Executivo

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

---

## Significado Do Projeto

O Maré é um sistema pessoal de acompanhamento financeiro. O produto não é apenas
um CRUD de transações: ele organiza o fluxo financeiro em torno de orçamento,
categorias, contas, compromissos recorrentes, parcelamentos, investimentos,
metas e visão histórica.

O conceito mais importante do domínio é o mês de referência. A maioria dos dados
financeiros é analisada e exibida por mês, e o projeto documenta que o mês deve
ser persistido como `YYYY-MM-01`.

O nome Maré combina com a proposta: acompanhar entradas, saídas, ciclos, saldos e
evolução patrimonial como movimentos recorrentes ao longo do tempo.

---

## Domínios Atuais

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
- proteção do layout autenticado com redirect para `/login`.

Observações:

- O provider `dev` retorna `null` fora de desenvolvimento, o que reduz o risco
  de login local em produção.
- Qualquer conta Google válida pode criar uma conta no app (cadastro aberto).

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

### Domínio devedores

Documentação: `docs/devedores/`

Resumo:

- Domínio próprio de contas a receber, separado de `transactions`.
- A decisão arquitetural está correta: dívida de outra pessoa não deve ser
  automaticamente tratada como gasto do usuário nem afetar orçamento.
- Toda action chama `auth()`, filtra por `userId` e valida ownership.

---

## Comandos Executados

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

### Verificações

```bash
npm run lint
npm run typecheck
npm audit --audit-level=moderate
```

Resultados:

- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm audit --audit-level=moderate`: falhou primeiro por restrição/rede no
  sandbox; depois rodou com acesso de rede e encontrou 13 vulnerabilidades.

Observação:

- `npm run build` não foi executado porque o script atual aplicava migrations antes
  de compilar.
