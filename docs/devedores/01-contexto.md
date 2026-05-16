# Devedores — Contexto e Decisões

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
