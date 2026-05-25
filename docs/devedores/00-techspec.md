# Tech Spec: Devedores

## Contexto

O Maré hoje controla o fluxo financeiro pessoal do usuário por mês de referência:
transações, entradas, gastos fixos, parcelamentos, investimentos, metas e orçamento.

O novo recurso deve permitir cadastrar pessoas e acompanhar valores que essas pessoas
devem ao usuário. Esses valores podem nascer de uma dívida manual ou de uma transação
já existente, por exemplo quando o usuário paga uma compra compartilhada e outra pessoa
precisa reembolsar parte do valor.

## Decisão Arquitetural Principal

Devedores serão tratados como um domínio próprio de contas a receber, não como um novo
tipo de `transactions`.

Motivo:

- `transactions` representa gastos do usuário e já alimenta dashboard, orçamento,
  panorama anual, parcelas e categorias.
- Dívida de outra pessoa não é necessariamente um novo gasto, nem deve afetar orçamento
  automaticamente.
- Uma transação pode gerar cobranças para uma ou mais pessoas.
- Uma cobrança também pode existir sem transação de origem.

O recurso deve reaproveitar padrões existentes do projeto, mas não misturar os modelos:

- Reaproveitar server actions, queries, validações Zod, dialogs, inputs de moeda,
  listas, badges e padrões de layout.
- Criar tabelas, queries e actions próprias para pessoas e lançamentos de dívida.

## Objetivo

Permitir que o usuário:

- cadastre pessoas com nome e contato opcional;
- registre valores que uma pessoa deve;
- vincule parte de uma transação existente a uma pessoa;
- registre pagamentos recebidos;
- veja o saldo em aberto por pessoa;
- veja o histórico de cobranças e pagamentos por pessoa.

## Não Objetivos Da Primeira Versão

- Não alterar automaticamente os cálculos do dashboard.
- Não abater despesas do orçamento por categoria.
- Não criar um novo tipo em `transactions`.
- Não enviar cobrança por email, SMS ou WhatsApp.
- Não criar recorrência de dívidas.
- Não dividir automaticamente uma compra entre várias pessoas em uma interface avançada.
- Não implementar anexos, comprovantes ou notificações.

## Modelo De Dados

### Nova Tabela: `people`

Representa pessoas cadastradas pelo usuário.

Campos:

- `id`: uuid, primary key.
- `userId`: uuid, obrigatório, referencia `users.id`, cascade delete.
- `name`: varchar(200), obrigatório.
- `email`: varchar(255), opcional.
- `phone`: varchar(40), opcional.
- `notes`: text, opcional.
- `archived`: boolean, default `false`.
- `createdAt`: timestamp, default now.
- `updatedAt`: timestamp, default now.

Observações:

- Não usar email ou telefone como identificador único.
- Permitir pessoas sem contato.
- Arquivar em vez de apagar deve ser o caminho padrão na UI quando houver histórico.
- Atualizar `updatedAt` manualmente nas actions de edição, seguindo o padrão simples do projeto.

### Nova Tabela: `debtor_entries`

Representa o razão financeiro de cada pessoa.

Campos:

- `id`: uuid, primary key.
- `userId`: uuid, obrigatório, referencia `users.id`, cascade delete.
- `personId`: uuid, obrigatório, referencia `people.id`, cascade delete.
- `type`: varchar(20), obrigatório.
  - `charge`: aumenta o valor devido.
  - `payment`: reduz o valor devido.
  - `adjustment`: ajuste manual positivo ou negativo.
- `amount`: decimal(10,2), obrigatório.
- `description`: varchar(200), obrigatório.
- `referenceMonth`: date, obrigatório, sempre `YYYY-MM-01`.
- `entryDate`: date, obrigatório. Representa quando a dívida ou pagamento aconteceu.
- `dueDate`: date, opcional.
- `sourceTransactionId`: uuid, opcional, referencia `transactions.id`, `onDelete: set null`.
- `incomeId`: uuid, opcional, referencia `incomes.id`, `onDelete: set null`.
- `notes`: text, opcional.
- `createdAt`: timestamp, default now.
- `updatedAt`: timestamp, default now.

Regras:

- `charge` usa `amount` positivo e aumenta saldo.
- `payment` usa `amount` positivo e reduz saldo.
- `adjustment` pode ser positivo ou negativo.
- Em lançamentos `charge`, `entryDate` é a data em que a pessoa passou a dever,
  normalmente o dia em que o usuário pagou algo, emprestou dinheiro ou combinou a cobrança.
- Em lançamentos `payment`, `entryDate` é a data em que o usuário recebeu o pagamento.
- `dueDate` é separado de `entryDate` e representa apenas o vencimento combinado.
- Todo registro deve pertencer ao mesmo `userId` da pessoa.
- Se `sourceTransactionId` existir, a transação também precisa pertencer ao mesmo `userId`.
- Se `incomeId` existir, a entrada também precisa pertencer ao mesmo `userId`.
- Na primeira versão, `sourceTransactionId` deve ser usado apenas em lançamentos `charge`.
- Na primeira versão, `incomeId` deve ser usado apenas em lançamentos `payment`.

## Cálculo De Saldo

Saldo de uma pessoa:

```txt
saldo = soma(charge.amount) - soma(payment.amount) + soma(adjustment.amount)
```

Onde:

- saldo maior que zero: pessoa deve ao usuário;
- saldo igual a zero: pessoa quitada;
- saldo menor que zero: pessoa pagou a mais ou houve ajuste excedente.

## Rotas E Navegação

### Nova Rota

`/devedores`

Adicionar aos menus:

- `components/layout/Sidebar.tsx`
- `components/layout/BottomNav.tsx`

Sugestão de ícone Lucide:

- `UsersRound` ou `HandCoins`

## Experiência Do Usuário

### Tela `/devedores`

Primeira versão em tela única com lista e detalhe simples.

Conteúdo:

- Page header: `Devedores`
- Descrição: `Acompanhe valores que outras pessoas devem a você.`
- Ação principal: `Nova pessoa`
- Cards de resumo:
  - total em aberto;
  - pessoas com saldo pendente;
  - valores vencidos, se houver `dueDate`.
- Lista de pessoas:
  - nome;
  - contato, se houver;
  - saldo em aberto;
  - último movimento;
  - ações: editar, registrar cobrança, registrar pagamento.

Estado vazio:

- título: `Nenhuma pessoa cadastrada.`
- ação: `Nova pessoa`

### Detalhe Da Pessoa

Pode começar como dialog/drawer aberto pela lista, sem rota dinâmica na primeira fase.

Conteúdo:

- nome e contato;
- saldo atual;
- botões:
  - `Adicionar valor`
  - `Registrar pagamento`
  - `Editar pessoa`
- histórico ordenado por data desc:
  - tipo;
  - descrição;
  - valor;
  - data;
  - transação vinculada, se houver.

## Formulários

### `PersonDialog`

Campos:

- nome, obrigatório;
- email, opcional;
- telefone, opcional;
- observações, opcional.

Actions:

- criar pessoa;
- editar pessoa;
- arquivar pessoa.

### `DebtChargeDialog`

Registra valor devido.

Campos:

- pessoa;
- descrição;
- valor;
- data em que a pessoa passou a dever;
- mês de referência;
- vencimento opcional;
- observações opcionais;
- transação de origem opcional.

Comportamento:

- se tiver transação de origem, gravar `sourceTransactionId`;
- se não tiver transação de origem, ainda assim gravar a data real da dívida em `entryDate`;
- não alterar a transação original;
- não alterar dashboard ou orçamento.

Exemplo:

- `entryDate`: `2026-05-08`
- descrição: `Almoço`
- valor: `42.00`
- pessoa: `Ana`
- resultado: Ana passou a dever R$ 42,00 em 08/05/2026.

### `DebtPaymentDialog`

Registra pagamento recebido.

Campos:

- pessoa;
- descrição;
- valor;
- data em que o pagamento foi recebido;
- mês de referência;
- checkbox: `Registrar também como entrada`;
- observações opcionais.

Comportamento:

- sempre cria `debtor_entries.type = payment`;
- se o checkbox estiver marcado, cria também uma linha em `incomes`;
- se criar `incomes`, salvar `incomeId` no lançamento de dívida.

Decisão inicial:

- O checkbox deve vir marcado por padrão, porque pagamento recebido normalmente entra no caixa.
- O usuário pode desmarcar quando quiser apenas ajustar o saldo da pessoa.

## Backend

### Criar `lib/queries/debtors.ts`

Funções:

- `getDebtorsOverview(userId: string)`
  - retorna totais agregados da tela;
  - total em aberto;
  - quantidade de pessoas com saldo positivo;
  - total vencido.

- `getPeopleWithBalances(userId: string)`
  - lista pessoas não arquivadas;
  - inclui saldo calculado;
  - inclui último movimento.

- `getPersonDebtDetails(userId: string, personId: string)`
  - dados da pessoa;
  - saldo;
  - histórico de lançamentos;
  - dados resumidos da transação vinculada quando houver.

- `getTransactionsForDebtLink(userId: string, referenceMonth?: string)`
  - lista transações que podem ser usadas como origem;
  - deve retornar id, nome, valor, data, categoria e conta.
  - entra somente na Fase 6.

Notas:

- Usar `toAmount()` para converter decimals.
- Preferir agregações com `GROUP BY` quando a lista crescer.
- Evitar N+1 queries para saldo por pessoa.

### Criar `lib/actions/debtors.ts`

Funções:

- `createPerson(data)`
- `updatePerson(data)`
- `archivePerson(id)`
- `deletePersonIfEmpty(id)`
- `createDebtCharge(data)`
- `createDebtChargeFromTransaction(data)`
- `createDebtPayment(data)`
- `deleteDebtEntry(id)`

Regras:

- Toda action chama `auth()` e extrai `userId`.
- Toda operação filtra por `userId`.
- Ao referenciar `personId`, validar que a pessoa pertence ao usuário.
- Ao referenciar `sourceTransactionId`, validar que a transação pertence ao usuário.
- Ao criar pagamento com entrada, inserir em `incomes` e usar o id retornado em `debtor_entries.incomeId`.
- `deletePersonIfEmpty` só pode apagar pessoa sem lançamentos; se houver histórico, usar `archivePerson`.
- Revalidar `/devedores`.
- Se pagamento criar entrada, revalidar também `/dashboard` e `/panorama`.

### Criar `lib/validations/debtors.ts`

Schemas:

- `personSchema`
- `debtChargeSchema`
- `debtPaymentSchema`
- `debtAdjustmentSchema`

Validações:

- nome obrigatório;
- valor maior que zero para `charge` e `payment`;
- datas válidas;
- email opcional em formato válido quando preenchido;
- telefone opcional como string simples, sem normalização rígida nesta versão.

## Frontend

### Criar Componentes Em `components/devedores/`

Componentes:

- `PersonDialog.tsx`
- `DebtChargeDialog.tsx`
- `DebtPaymentDialog.tsx`
- `DebtorSummaryCards.tsx`
- `DebtorList.tsx`
- `DebtorDetailDialog.tsx`
- `DebtEntryList.tsx`
- `TransactionDebtLinkDialog.tsx`

Padrões:

- Usar `PageLayout`, `PageHeader`, `Section`, `Card`, `Badge`, `Button`, `Field`,
  `Input`, `CurrencyInput`, `Select`, `DeleteButton`.
- Dialog desktop + drawer mobile apenas se o componente precisar de boa ergonomia em mobile.
- Não criar componentes genéricos em `components/ui/` a menos que sejam reutilizáveis fora de devedores.

### Criar Página

Arquivo:

- `app/(app)/devedores/page.tsx`

Responsabilidades:

- validar sessão;
- carregar overview e pessoas com saldo;
- renderizar header, resumo e lista;
- passar dados para dialogs client-side.

## Integração Com Transações Existentes

### Fase Inicial

Na tela de devedores, o usuário pode escolher uma transação existente ao criar cobrança.

Fluxo:

1. Usuário abre `Adicionar valor`.
2. Escolhe pessoa.
3. Opcionalmente seleciona uma transação de origem.
4. Informa o valor que aquela pessoa deve.
5. Sistema cria `debtor_entries.type = charge`.

Regra:

- O valor atribuído deve ser maior que zero.
- Por padrão, não bloquear valor maior que a transação, mas exibir aviso na UI se passar do total.

Motivo:

- Existem casos reais em que a dívida inclui taxa, arredondamento ou acordo fora do valor original.
- Bloquear cedo demais pode atrapalhar uso real.

### Fase Posterior Opcional

Adicionar ação dentro da lista de transações:

- `Atribuir a devedor`

Isso pode entrar depois que a tela principal estiver estável.

## Impacto Em Relatórios

### Dashboard

Primeira versão:

- não muda cálculo de saldo;
- não muda orçamento;
- não muda gastos por categoria.

Somente pagamentos registrados como entrada aparecem no dashboard.

### Panorama Anual

Primeira versão:

- só muda se pagamento criar `income`.

### Orçamento Por Categoria

Primeira versão:

- sem impacto.

## Fases De Implementação

### Fase 1: Banco E Tipos

Objetivo:

- criar base persistente do recurso.

Passos:

1. Adicionar tabelas `people` e `debtor_entries` em `lib/db/schema.ts`.
2. Adicionar relações Drizzle.
3. Rodar `npm run db:generate`.
4. Formatar migrations geradas, especialmente `lib/db/migrations/meta/`.
5. Rodar `npm run typecheck`.

Critério de aceite:

- schema compila;
- migration gerada;
- não há erro de typecheck.

### Fase 2: Validações, Queries E Actions

Objetivo:

- criar API interna server-side do domínio.

Passos:

1. Criar `lib/validations/debtors.ts`.
2. Criar `lib/queries/debtors.ts`.
3. Criar `lib/actions/debtors.ts`.
4. Garantir validação de `userId` em pessoa, transação e entrada.
5. Revalidar `/devedores` nas mutações.
6. Revalidar `/dashboard` e `/panorama` quando pagamento gerar `income`.
7. Rodar `npm run typecheck`.

Critério de aceite:

- actions não permitem acessar dados de outro usuário;
- saldo é calculado corretamente;
- pagamento pode ou não criar entrada.

### Fase 3: Página E Cadastro De Pessoas

Objetivo:

- permitir cadastrar, editar e listar pessoas.

Passos:

1. Criar `app/(app)/devedores/page.tsx`.
2. Criar `components/devedores/PersonDialog.tsx`.
3. Criar `components/devedores/DebtorList.tsx`.
4. Criar estado vazio.
5. Adicionar `/devedores` no `Sidebar`.
6. Adicionar `/devedores` no menu mobile do `BottomNav`.
7. Rodar `npm run lint` e `npm run typecheck`.

Critério de aceite:

- usuário consegue criar pessoa;
- usuário consegue editar pessoa;
- pessoa aparece na lista;
- rota aparece na navegação desktop e mobile.

### Fase 4: Cobranças Manuais

Objetivo:

- permitir registrar valores que uma pessoa deve sem transação de origem.

Passos:

1. Criar `DebtChargeDialog`.
2. Criar `DebtorSummaryCards`.
3. Mostrar saldo por pessoa.
4. Mostrar total em aberto.
5. Mostrar histórico simples.
6. Rodar `npm run lint` e `npm run typecheck`.

Critério de aceite:

- cobrança aumenta saldo da pessoa;
- total em aberto reflete a cobrança;
- histórico mostra o lançamento.

### Fase 5: Pagamentos

Objetivo:

- permitir registrar pagamento e reduzir saldo.

Passos:

1. Criar `DebtPaymentDialog`.
2. Implementar checkbox `Registrar também como entrada`.
3. Se marcado, criar `income` vinculado.
4. Mostrar pagamento no histórico.
5. Atualizar saldo da pessoa.
6. Rodar `npm run lint` e `npm run typecheck`.

Critério de aceite:

- pagamento reduz saldo;
- pagamento com entrada aparece no dashboard como entrada;
- pagamento sem entrada altera apenas o módulo de devedores.

### Fase 6: Vínculo Com Transações

Objetivo:

- permitir criar dívida a partir de uma transação existente.

Passos:

1. Criar query `getTransactionsForDebtLink`.
2. Criar action `createDebtChargeFromTransaction`.
3. Adicionar seleção de transação no `DebtChargeDialog`.
4. Salvar `sourceTransactionId`.
5. Mostrar transação vinculada no histórico.
6. Exibir aviso se valor atribuído for maior que o valor da transação.
7. Rodar `npm run lint` e `npm run typecheck`.

Critério de aceite:

- usuário consegue vincular cobrança a uma transação;
- transação original não muda;
- histórico mostra origem da cobrança.

### Fase 7: Ajustes E Exclusão Segura

Objetivo:

- lidar com correções e remoções sem quebrar histórico.

Passos:

1. Implementar exclusão de lançamento quando não houver vínculo sensível.
2. Se `debtor_entries.incomeId` existir, decidir na UI se também remove a entrada.
3. Adicionar ajuste manual se necessário.
4. Implementar arquivamento de pessoa.
5. Implementar exclusão definitiva apenas para pessoa sem lançamentos.
6. Rodar `npm run lint`, `npm run typecheck` e `npm run build`.

Critério de aceite:

- usuário consegue corrigir lançamentos;
- pessoa arquivada some da lista principal;
- histórico financeiro não é perdido sem confirmação clara.

## Questões Para Decidir Durante A Implementação

1. Pagamento com `income`: ao excluir o pagamento, devemos excluir também a entrada vinculada?
   - Recomendação: perguntar na UI.

2. Pessoa com histórico pode ser apagada?
   - Recomendação: não apagar por padrão; arquivar.

3. Cobranças devem ter vencimento obrigatório?
   - Recomendação: não na primeira versão.

4. A tela deve ter rota dinâmica `/devedores/[id]`?
   - Recomendação: começar com dialog/drawer; migrar para rota dinâmica se o detalhe crescer.

5. Devedores devem aparecer no dashboard?
   - Recomendação: não na primeira versão, exceto pagamentos que virarem entrada.

## Arquivos Prováveis

Adicionar:

- `app/(app)/devedores/page.tsx`
- `app/(app)/devedores/loading.tsx`
- `components/devedores/PersonDialog.tsx`
- `components/devedores/DebtChargeDialog.tsx`
- `components/devedores/DebtPaymentDialog.tsx`
- `components/devedores/DebtorSummaryCards.tsx`
- `components/devedores/DebtorList.tsx`
- `components/devedores/DebtorDetailDialog.tsx`
- `components/devedores/DebtEntryList.tsx`
- `components/devedores/TransactionDebtLinkDialog.tsx`
- `lib/queries/debtors.ts`
- `lib/actions/debtors.ts`
- `lib/validations/debtors.ts`

Alterar:

- `lib/db/schema.ts`
- `components/layout/Sidebar.tsx`
- `components/layout/BottomNav.tsx`

Gerar:

- nova migration em `lib/db/migrations/`
- novo snapshot em `lib/db/migrations/meta/`

## Ordem Recomendada Para Trabalhar

1. Fase 1.
2. Fase 2.
3. Fase 3.
4. Validar manualmente cadastro de pessoa.
5. Fase 4.
6. Validar saldo com cobrança manual.
7. Fase 5.
8. Validar saldo e impacto opcional em dashboard.
9. Fase 6.
10. Validar vínculo com transação existente.
11. Fase 7 somente depois do fluxo principal estar funcionando.
