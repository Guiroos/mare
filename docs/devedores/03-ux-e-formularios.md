# Devedores — UX e Formulários

## Rota e Navegação

Nova rota: `/devedores`

Adicionar entrada nos menus:

- `components/layout/Sidebar.tsx`
- `components/layout/BottomNav.tsx`

Ícone Lucide sugerido: `UsersRound` ou `HandCoins`

## Tela `/devedores`

Lista principal. Detalhe em rota própria `/devedores/[id]`.

**Cabeçalho:**

- Page header: `Devedores`
- Descrição: `Acompanhe valores que outras pessoas devem a você.`
- Ação principal: `Nova pessoa`

**Cards de resumo:**

- Total em aberto
- Pessoas com saldo pendente

**Lista de pessoas:**

- Nome clicável → navega para `/devedores/[id]`
- Contato (se houver)
- Saldo em aberto
- Último movimento
- Row actions: `Editar`, `Excluir` (padrão `RowActions`)

**Estado vazio:**

- Título: `Nenhuma pessoa cadastrada.`
- Ação: `Nova pessoa`

## Detalhe Da Pessoa — `/devedores/[id]`

Rota dinâmica desde a primeira versão. Acessada clicando no nome da pessoa na lista.

Conteúdo mínimo v1:

- Nome e contato
- Saldo atual
- Botões de ação primários: `Registrar cobrança`, `Registrar pagamento`
- Ação secundária: `Editar pessoa` (abre `PersonDialog`)
- Histórico de lançamentos ordenado por `entryDate DESC`: tipo, descrição, valor, data, transação vinculada (se houver)

Os botões abrem seus respectivos dialogs (`DebtChargeDialog`, `DebtPaymentDialog`, `PersonDialog`) — uma camada de modal por vez, sem empilhamento.

Concentrar `Registrar cobrança` e `Registrar pagamento` na tela de detalhe (não na lista) mantém o contexto da pessoa sempre presente e elimina o seletor de pessoa dos formulários.

A evolução da tela de detalhe para um painel completo (resumo financeiro, gráfico de saldo, histórico agrupado e filtros) está planejada em `06-planejamento-detalhe-pessoa.md` — implementação pendente.

## Formulários

### `PersonDialog`

Campos:

| Campo          | Obrigatório |
| -------------- | ----------- |
| Nome           | sim         |
| Email          | não         |
| Telefone       | não         |
| Observações    | não         |

Actions: criar pessoa, editar pessoa, arquivar pessoa.

Comportamento do arquivamento:

- Se a pessoa tiver saldo positivo, exibir confirmação com aviso: `"[Nome] ainda tem R$ X,XX em aberto. Ao arquivá-la, esse valor não aparecerá mais no total em aberto. Deseja continuar?"`
- Se saldo for zero ou negativo, arquivar com confirmação simples.
- `PersonDialog` recebe `balance` como prop — não faz fetch próprio. Na lista, o valor vem de `getPeopleWithBalances`; no detalhe, vem da query da página.

### `DebtChargeDialog`

Registra valor devido.

Campos:

| Campo                   | Obrigatório | Notas                                          |
| ----------------------- | ----------- | ---------------------------------------------- |
| Pessoa                  | sim         | pré-selecionada e oculta quando aberto de `/devedores/[id]` |
| Descrição               | sim         |                                                |
| Valor                   | sim         |                                                |
| Data da dívida          | sim         | quando a pessoa passou a dever → `entryDate`   |
| Vencimento              | —           | reservado para uso futuro; não exibido na v1   |
| Observações             | não         |                                                |
| Transação de origem     | não         | → `sourceTransactionId`; exibe transações dos últimos 6 meses |

Comportamento:

- Se tiver transação de origem, gravar `sourceTransactionId`.
- Não alterar a transação original.
- Não alterar dashboard ou orçamento.
- Exibir aviso na UI se valor atribuído for maior que o da transação (sem bloquear).
- Abaixo do seletor de transação, exibir nota fixa: `"Exibindo transações dos últimos 6 meses. Para transações mais antigas, registre a cobrança sem vínculo."`

Exemplo:

```
entryDate:   2026-05-08
descrição:   Almoço
valor:       42.00
pessoa:      Ana
resultado:   Ana passou a dever R$ 42,00 em 08/05/2026
```

### `DebtPaymentDialog`

Registra pagamento recebido.

Campos:

| Campo                          | Obrigatório | Notas                                        |
| ------------------------------ | ----------- | -------------------------------------------- |
| Pessoa                         | sim         | pré-selecionada e oculta quando aberto de `/devedores/[id]` |
| Descrição                      | sim         |                                              |
| Valor                          | sim         |                                              |
| Data do recebimento            | sim         | → `entryDate`                                |
| Registrar também como entrada  | —           | checkbox; marcado por padrão                 |
| Mês de referência              | condicional | exibido apenas quando checkbox marcado; default mês atual; → `referenceMonth` |
| Observações                    | não         |                                              |

Comportamento:

- Sempre cria `debtor_entries.type = payment`.
- Se checkbox marcado: exibe campo `Mês de referência` (obrigatório), cria linha em `incomes` naquele mês e salva `incomeId` no lançamento.
- Se checkbox desmarcado: `referenceMonth` não é enviado nem exigido.
- Checkbox marcado por padrão porque pagamento recebido normalmente entra no caixa.
- Usuário pode desmarcar quando quiser apenas ajustar o saldo da pessoa sem afetar o dashboard.
- O campo descrição deve ter placeholder focado no motivo, ex.: `"Reembolso do almoço"` — o nome da pessoa não precisa ser repetido aqui.

## Padrões de Componentes

- Usar `PageLayout`, `PageHeader`, `Section`, `Card`, `Badge`, `Button`, `Field`,
  `Input`, `CurrencyInput`, `Select`, `DeleteButton`.
- Dialog desktop + drawer mobile para formulários que precisam de boa ergonomia em mobile.
- Não criar componentes genéricos em `components/ui/` a menos que sejam reutilizáveis fora de devedores.

## Integração Com Transações

Fluxo (a partir de `/devedores/[id]`, pessoa já conhecida pelo contexto da rota):

1. Usuário abre `Registrar cobrança`.
2. Opcionalmente seleciona uma transação de origem no `Select` (últimos 6 meses).
3. Informa o valor que aquela pessoa deve.
4. Sistema cria `debtor_entries.type = charge` com ou sem `sourceTransactionId`.

Regra: valor atribuído deve ser maior que zero. Se o valor for maior que o da transação selecionada, exibir aviso inline (sem bloquear o envio).

Motivo: existem casos reais em que a dívida inclui taxa, arredondamento ou acordo fora
do valor original.

### Fase Posterior Opcional

Adicionar ação `Atribuir a devedor` dentro da lista de transações existentes.
Entra depois que a tela principal estiver estável.
