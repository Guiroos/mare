# Devedores — Planejamento da Tela de Detalhe

## Contexto

A rota `/devedores/[id]` nasceu na v1 como uma tela funcional mínima:

- voltar para a lista;
- ver nome/contato da pessoa;
- ver saldo atual;
- editar pessoa;
- registrar cobrança;
- registrar pagamento;
- ver histórico de lançamentos.

Essa base resolve o fluxo operacional, mas ainda não ajuda tanto o usuário a entender a relação financeira com aquela pessoa. A próxima melhoria deve transformar a tela de detalhe em um painel de acompanhamento: o usuário precisa bater o olho e entender quanto está em aberto, quanto já foi cobrado, quanto já foi recebido, como o saldo evoluiu e quais lançamentos explicam o estado atual.

## Objetivo da Subfeature

Melhorar `/devedores/[id]` para responder rapidamente:

- qual é a situação atual dessa pessoa;
- quanto já foi cobrado;
- quanto já foi pago;
- quando aconteceu o último movimento;
- como o saldo evoluiu ao longo do tempo;
- quais lançamentos compõem o saldo atual;
- o que o usuário pode fazer em seguida.

## Não Objetivos

Esta subfeature não deve incluir:

- vencimento de cobrança (`dueDate`) como fluxo principal;
- notificações, lembretes ou cobrança por WhatsApp/email;
- ação "Atribuir a devedor" dentro de `/registro`;
- alteração automática de dashboard, orçamento ou categorias;
- split avançado de uma compra entre várias pessoas;
- edição completa de lançamentos já criados.

Esses temas podem voltar depois, mas misturá-los agora aumenta o escopo e tira foco da tela de detalhe.

## Problema Atual da Tela

A implementação atual tem os elementos certos, mas ainda com pouca hierarquia:

- o saldo atual aparece isolado, sem contexto de total cobrado e total recebido;
- as ações principais competem visualmente com o conteúdo, mas não formam uma área clara de próximos passos;
- o histórico é uma lista simples e útil para auditoria, mas fraca para leitura rápida;
- não há visão temporal da evolução da dívida;
- não há filtros para o usuário encontrar pagamentos, cobranças ou lançamentos antigos;
- notas, origem da transação e entrada financeira vinculada aparecem de forma resumida, sem um modo claro de inspeção.

## Princípios de UX

1. A tela deve começar pelo estado atual da relação financeira.
2. As ações devem ficar próximas do contexto, mas sem dominar a tela.
3. O histórico precisa continuar auditável, porque ele é a fonte do saldo.
4. O gráfico deve explicar o saldo, não decorar a página.
5. A versão mobile deve priorizar leitura e ações rápidas.
6. Nenhum dado dessa tela deve mudar orçamento ou dashboard, exceto pagamentos que o usuário registrar como entrada, preservando a regra da v1.

## Layout Proposto

### 1. Cabeçalho

Manter:

- link de retorno para `/devedores`;
- nome da pessoa;
- contato principal quando existir;
- botão `Editar pessoa`.

Melhorar:

- exibir um badge de estado junto ao nome ou abaixo dele:
  - `Em aberto`, quando saldo > 0;
  - `Quitado`, quando saldo = 0 **e** houver ao menos um lançamento;
  - `Crédito`, quando saldo < 0;
  - sem badge quando não houver lançamentos — a tela entra no estado vazio.
- exibir contato e observações de forma discreta, sem transformar o topo em card pesado.

### 2. Resumo Financeiro

Substituir o card único de saldo por um bloco de resumo com hierarquia clara.

Métricas:

| Métrica | Descrição | Fonte |
| ------- | --------- | ----- |
| Saldo atual | valor líquido atual da pessoa | `charge + adjustment - payment` |
| Total cobrado | soma de `charge` + `adjustment` | entries |
| Total recebido | soma de `payment` | entries |
| Último movimento | data mais recente em `entryDate` | entries |

`adjustment` é fundido com `charge` no `totalCharged` porque não tem semântica própria consolidada. Se futuramente ganhar finalidade distinta (ex: juros, desconto), revisitar o resumo.

Comportamento visual:

- `Saldo atual` deve ser o destaque principal.
- `Total cobrado`, `Total recebido` e `Último movimento` entram como cards menores.
- Se saldo for zero, o bloco deve deixar claro que a pessoa está quitada.
- Se saldo for negativo, mostrar como crédito do usuário com a pessoa, não como erro.

### 3. Área de Ações

Manter as duas ações principais:

- `Registrar cobrança`;
- `Registrar pagamento`.

Melhorar:

- agrupar as ações em uma faixa simples logo após o resumo;
- no desktop, manter botões lado a lado;
- no mobile, usar botões em largura total ou uma barra de ação compacta ao final do primeiro viewport;
- preservar uma camada de modal por vez.

Não adicionar novas ações nesta fase.

### 4. Evolução do Saldo

Adicionar uma seção `Evolução do saldo`.

Objetivo:

- mostrar como a dívida cresceu ou foi sendo paga ao longo do tempo;
- facilitar identificar picos, quitações e reaberturas de dívida.

Dados:

- basear em `entryDate`, porque ela representa quando a dívida ou pagamento aconteceu;
- ordenar lançamentos por `entryDate` crescente;
- calcular saldo acumulado progressivamente sobre todos os lançamentos;
- pegar o saldo ao final de cada mês como o único ponto daquele mês (um ponto por mês).

Visual:

- gráfico de linha simples com saldo acumulado;
- altura compacta, algo próximo de 220px;
- tooltip com mês e saldo;
- estado vazio quando houver menos de dois pontos úteis.

Regra:

- não usar `referenceMonth` para esse gráfico; `referenceMonth` serve para caixa/dashboard quando há `income`, enquanto a evolução da relação com a pessoa deve seguir `entryDate`.

### 5. Histórico Melhorado

Manter o histórico como fonte auditável do saldo, mas melhorar leitura e navegação.

Melhorias:

- adicionar filtros por tipo:
  - `Todos`;
  - `Cobranças`;
  - `Pagamentos`.
- adicionar filtro de período simples:
  - `Todo período`;
  - `Últimos 30 dias`;
  - `Últimos 6 meses`;
  - `Ano atual`.
- agrupar lançamentos por mês de `entryDate`;
- exibir total líquido do grupo mensal;
- permitir expandir ou detalhar um lançamento para ver:
  - observações;
  - transação de origem;
  - entrada financeira vinculada;
  - mês de referência, quando relevante.

Primeira entrega recomendada:

- implementar filtros por tipo;
- agrupar por mês;
- deixar busca textual e filtro por período para uma fase seguinte, se necessário.

### 6. Estados Vazios

Estados necessários:

| Situação | UI esperada |
| -------- | ----------- |
| Pessoa sem lançamentos | resumo zerado, gráfico vazio e chamada para registrar primeira cobrança |
| Pessoa quitada | saldo `R$ 0,00`, badge `Quitado`, histórico preservado |
| Pessoa com crédito | saldo destacado como crédito, sem tratar como erro |
| Sem dados suficientes para gráfico | mensagem curta dentro da área do gráfico |

## Contrato de Dados

Criar ou ajustar a query de detalhe para retornar dados já preparados para a tela, evitando cálculo espalhado em componentes client.

Sugestão:

```ts
type PersonDebtDetails = {
  person: PersonDebtPerson
  summary: {
    balance: number
    totalCharged: number   // charge + adjustment
    totalPaid: number      // payment
    lastMovement: string | null
    chargeCount: number    // charge + adjustment — usado em lógicas internas, não exibido como card
    paymentCount: number
  }
  balanceEvolution: {
    month: string   // "YYYY-MM"
    balance: number // saldo ao final do mês
  }[]
  entries: DebtEntryDetail[]
}
```

Notas:

- `balance` do nível raiz anterior é removido; tudo passa por `summary.balance` — sem alias de transição.
- `balanceEvolution` calculado server-side: ordenar lançamentos por `entryDate` crescente, acumular saldo progressivamente, pegar o último valor de cada mês.
- `entries` completo para o histórico auditável.
- Se futuramente `dueDate` entrar, ela deve ser adicionada a `DebtEntryDetail`, mas não é requisito desta subfeature.

## Componentes Prováveis

Criar componentes específicos em `components/devedores/`, não em `components/ui/`, porque o comportamento é de domínio.

| Componente | Responsabilidade |
| ---------- | ---------------- |
| `DebtorDetailSummary` | bloco de saldo atual, total cobrado, total recebido e último movimento |
| `DebtBalanceEvolutionChart` | gráfico de linha do saldo acumulado por mês |
| `DebtEntryList` | lista com filtros de tipo encapsulados — estado do filtro vive aqui, não sobe para a page |

`DebtMovementStats` foi removido do escopo — as métricas de contagem e maiores valores não habilitam decisão do usuário e o histórico já cobre essa leitura.

Evitar criar novos componentes genéricos enquanto só devedores usar esse padrão.

## Fases de Implementação

### Fase 1 — Dados e Resumo

Objetivo: melhorar o topo da tela sem mexer no histórico.

Passos:

- [ ] Alterar `getPersonDebtDetails`: remover `balance` do nível raiz, adicionar `summary` com `balance`, `totalCharged` (charge + adjustment), `totalPaid`, `lastMovement`, `chargeCount`, `paymentCount`.
- [ ] Atualizar todos os consumidores de `balance` para `summary.balance`.
- [ ] Criar `DebtorDetailSummary` com badge de estado (`Em aberto` / `Quitado` / `Crédito` — `Quitado` só quando `entries.length > 0`).
- [ ] Substituir o card único de saldo na página.
- [ ] Manter `DebtChargeDialog` e `DebtPaymentDialog` funcionando sem alteração de contrato.

Critérios de aceite:

- usuário vê saldo atual, total cobrado, total recebido e último movimento;
- saldo continua igual ao cálculo anterior;
- pessoa sem lançamentos renderiza sem erro;
- `npm run lint` e `npm run typecheck` passam.

### Fase 2 — Evolução do Saldo

Objetivo: adicionar leitura temporal.

Passos:

- [ ] Calcular `balanceEvolution` em `getPersonDebtDetails`: ordenar lançamentos por `entryDate` crescente, acumular saldo progressivamente, pegar o último valor de cada mês.
- [ ] Criar `DebtBalanceEvolutionChart` com um ponto por mês.
- [ ] Adicionar seção `Evolução do saldo` abaixo das ações.
- [ ] Tratar estado com menos de dois pontos (mensagem dentro da área do gráfico).

Critérios de aceite:

- gráfico mostra saldo acumulado por mês usando `entryDate`;
- pagamentos reduzem a linha;
- cobranças aumentam a linha;
- estado vazio aparece quando não há dados suficientes.

### Fase 3 — Histórico Agrupado e Filtros

Objetivo: tornar a lista mais navegável sem perder auditabilidade.

Passos:

- [ ] Adicionar filtro por tipo dentro de `DebtEntryList` (estado encapsulado no componente): todos/cobranças/pagamentos.
- [ ] Agrupar lançamentos por mês de `entryDate`.
- [ ] Mostrar subtotal líquido por grupo mensal.
- [ ] Preservar exclusão de cobrança simples e pagamento simples.
- [ ] Preservar confirmação especial para pagamento com `incomeId`.

Critérios de aceite:

- filtro não altera dados no servidor, apenas a visualização;
- agrupamento mensal mantém ordenação decrescente;
- ações de exclusão continuam disponíveis nos mesmos casos da v1;
- histórico vazio após filtro mostra mensagem específica.

### Fase 4 — Refinos Opcionais

Entram só se a tela ainda pedir mais navegação depois das fases anteriores:

- filtro por período;
- busca por descrição, notas ou transação de origem;
- detalhe expansível por lançamento;
- card de maiores movimentações;
- ação para copiar contato da pessoa.

## Riscos e Decisões

| Tema | Decisão |
| ---- | ------- |
| Usar `entryDate` ou `referenceMonth` no gráfico | usar `entryDate` |
| Granularidade do gráfico | um ponto por mês (saldo ao final do mês) — não um ponto por lançamento |
| `adjustment` no resumo | fundido com `charge` em `totalCharged`; sem linha separada na UI |
| Badge `Quitado` | apenas quando `balance = 0 && entries.length > 0`; sem badge para pessoa sem histórico |
| `balance` vs `summary.balance` | rename direto; sem alias de transição |
| Estado do filtro do histórico | encapsulado em `DebtEntryList`; não sobe para a page |
| `DebtMovementStats` | removido do escopo |
| Implementar `dueDate` junto | não nesta subfeature |
| Criar componentes genéricos | não; manter em `components/devedores/` |
| Fazer filtros server-side | não; a tela carrega os lançamentos da pessoa e filtra no client |
| Editar lançamentos existentes | fora do escopo |
| Excluir cobranças vinculadas | manter comportamento atual; se a UI mudar nesse ponto, criar regra server-side explícita antes |

## Arquivos Esperados

Prováveis alterações:

- `app/(app)/devedores/[id]/page.tsx`
- `lib/queries/debtors.ts`
- `components/devedores/DebtorDetailSummary.tsx`
- `components/devedores/DebtBalanceEvolutionChart.tsx`
- `components/devedores/DebtEntryList.tsx` (filtros encapsulados aqui)

Documentação:

- `docs/devedores/README.md`
- `docs/devedores/05-roadmap.md`

## Resultado Esperado

Ao final, `/devedores/[id]` deixa de ser apenas uma tela com ações e lista. Ela passa a funcionar como um painel de acompanhamento da pessoa: primeiro mostra o estado atual, depois explica a evolução, depois permite auditar os lançamentos e, por fim, oferece as ações de cobrança e pagamento sem deslocar o usuário para outro fluxo.
