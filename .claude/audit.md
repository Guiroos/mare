# Critérios de auditoria deste projeto

Referenciado por `CLAUDE.md` via `@`. Usado pela Routine `auditoria-diaria` e por qualquer revisão de código (manual ou `/code-review`) neste repositório.

A Routine define o **processo** (dedup, teto de issues, formato). Este arquivo define o **julgamento**: o que conta como bug aqui, o que ignorar, e onde procurar em cada dia.

---

## O que é bug aqui

Ordenado por rendimento observado — as três primeiras categorias produziram a maioria dos achados reais até hoje.

### 1. Fronteira de criptografia

Colunas cifradas tratadas como texto comum. O tipo do Drizzle diz `string` e o compilador aceita, mas o valor em runtime é `enc:AAAA...`.

- Coluna cifrada lida direto via `db.query.*` em vez da função de `lib/queries/` que decripta — e renderizada na UI (issue #31: filtros de `/historico` exibindo ciphertext)
- `ORDER BY`, `SUM`, `GROUP BY` ou `ILIKE` sobre coluna cifrada — ordena/soma/busca ciphertext em silêncio
- Escrita derivada que esquece de cifrar: insert de `income`/`debtorEntry` a partir de outra entidade
- Interpolação de ciphertext em template string — gera valor que começa com `enc:` mas não decifra
- `decryptField` em campo nullable (deveria ser `decryptOptional`)

Referência: `.claude/crypto.md`.

### 2. Camada de dados e queries

- `inArray`/`notInArray` sem guard de array vazio — gera `IN ()`, SQL inválido
- `findFirst` dentro de `db.transaction` cujo `null` não é verificado
- Mutação em múltiplas tabelas fora de `db.transaction`
- `revalidatePath` faltando num caminho que a mudança afeta **e que é servido de cache** — em especial `/panorama`, que toda action de dado financeiro precisa revalidar junto com `/dashboard`. Atenção ao limite: toda rota de `(app)` é dinâmica (passa por `auth()`, que lê cookies) e o projeto não configura `staleTimes`, cujo default `dynamic: 0` no Next ≥ 15 refaz o fetch em toda navegação. Em rota dinâmica a ausência da chamada **não** produz render obsoleto — é quebra de convenção, não bug, e precisa de outro impacto para se sustentar
- Agregação que poderia ser N+1 quando já existe variante batch (`getOpenChargesForPeople` vs. chamar `getOpenChargesForPerson` em loop)
- `toAmount()` ausente em campo `decimal` — `Number(x.amount)` sobre string

Referência: `.claude/db.md`, `.claude/domain.md`.

### 3. Fronteiras de entrada sem validação

- `searchParams` ou parâmetro de route handler indo direto para uma query sem passar por schema Zod — id não-UUID chega ao Postgres e vira 500 onde deveria ser 404/400 (issue #33)
- String crua da URL interpolada em header de resposta sem sanitizar (issue #32: `Content-Disposition`)
- Action que referencia `categoryId`/`accountId`/`personId` do cliente sem `assertOwns*` antes
- Rota de cron sem `timingSafeEqual` ou que não recusa quando `CRON_SECRET` é indefinido

Referência: `.claude/auth.md`.

### 4. Erro que não chega ao usuário — ou chega errado

- `catch {}` sem log e sem feedback
- `catch` que afirma uma causa específica que o código não conhece — pior que mensagem genérica, porque manda o usuário para o lado errado (issue #35: "item em uso" para falha de rede)
- Mensagem de `throw new Error()` em Server Action consumida como `err.message` no cliente: em build de produção o React descarta a mensagem original (issue #34). Falha esperada deve virar retorno tipado, não exceção
- Dialog de mutação que fecha no `catch` — esconde a falha e sugere sucesso

### 5. Regra de negócio replicada com definições divergentes

O padrão mais caro encontrado até agora: a mesma regra implementada em dois lugares com predicados diferentes, sem que nada force consistência.

Caso de referência (issue #36): "conta de crédito sob regime de fatura" existe como `type='credit' AND closingDay > 1` em 5 sites e como só `type='credit'` em 2 queries — o conjunto entre as duas definições some do gráfico de evolução e do Panorama sem aparecer em fatura nenhuma.

Ao encontrar um predicado de domínio, levantar **todos** os sites que o expressam antes de reportar. Se a maioria segue uma forma e uma minoria segue outra, a minoria é o bug — não é discussão de arquitetura.

### 6. React e estado

- Estado derivado em `useState` em vez de calculado no render
- `useEffect` com dependência faltando ou sem cleanup
- Fetch em cascata (waterfall) onde caberia `Promise.all`
- `any` explícito ou implícito em código de domínio

---

## O que NÃO reportar

- Preferência de estilo já coberta por ESLint/Prettier
- Sugestão de trocar biblioteca ou framework
- "Adicionar testes" como issue genérica sem apontar o caso não coberto
- Otimização sem evidência de custo real
- Regra de Design System — o agente `ds-reviewer` já cobre `components/ui/` contra `.claude/ds-components.md`
- Gotcha já documentado em `.claude/*.md` como decisão intencional (ex: cores hardcoded nos gráficos Recharts, marcadas como fase 2)
- Vulnerabilidade de dependência que já tem PR do Dependabot aberto — o valor está no que o Dependabot **não** pega (ver foco de terça)
- Achado cuja correção depende de decisão de produto ainda não tomada

---

## Candidatos já falsificados

Consultar **antes** de gastar a falsificação do PASSO 3.5. Cada linha aqui já morreu em pelo menos duas execuções independentes, sempre pela mesma checagem — 11 candidatos, ~24 re-derivações entre 2026-08-04 e 2026-08-25. Recandidatar um deles sem trazer fato novo é gastar um ciclo para chegar à mesma conclusão.

Isso não é uma lista de "não olhe": é uma lista de **o que já foi verificado e com qual evidência**. A coluna final diz o que precisaria mudar para o candidato voltar a valer.

| Candidato | Onde | Morre por | Volta a valer se |
| --- | --- | --- | --- |
| `notInArray(accountId, creditAccountIds)` some com linha de `accountId` NULL | `dashboard.ts`, `panorama.ts` | `accountId` é `.notNull()` em `transactions` (`schema.ts:174`) e `fixedExpenses` (`schema.ts:135`) | alguma migration tornar a coluna nullable |
| `overrides` do `package.json` sem justificativa | `package.json` | `9a2b0b4` documenta os dois na mensagem, inclusive o no-op do `form-data` | entrar override novo cujo commit não explique |
| `revalidatePath` ausente nas actions de `paymentAccounts` | `lib/actions/categories.ts` | rota dinâmica sob `staleTimes.dynamic: 0` — sem render obsoleto demonstrável (ver categoria 2) | o projeto passar a configurar `staleTimes` ou a rota virar estática |
| `formatGroupDate`/`groupByDate` duplicados byte a byte | `HistoricoClient.tsx:39`, `TransactionList.tsx:98` | cópias idênticas, zero divergência, custo de bundle zero | as duas divergirem — aí é categoria 5, foco de sexta |
| `TxItem` com `onClick` em `<div>` sem `role`/`tabIndex` | `tx-list.tsx:79` | nenhum call site passa `onClick` (`CategoryGroupProgress.tsx:74,84`) | algum call site passar `onClick` |
| `CategoryPicker` variante `grid` sem estado acessível | `components/forms/transaction/CategoryPicker.tsx:80` | variante não renderizada: os 5 call sites e o default passam `'combobox'` | alguém passar `categoryVariant="grid"` |
| `?cycleAccount=` cru sem validação de UUID | `app/(app)/dashboard/page.tsx:50` | `creditAccounts.find((a) => a.id === cycleAccount)` — array em memória, não chega ao Postgres | o parâmetro passar a alimentar uma query |
| `installmentAmount` sem compensação de arredondamento no create | `transactions.ts:273` vs. `:444-451` | fórmula documentada em `.claude/domain.md`; erro de no máximo (n−1) centavos | a magnitude mudar, ou o `domain.md` mudar de posição |
| `settleCharge`/`createDebtPayment` aceitam `personId` divergente do da cobrança | `debtors.ts` | ownership correto; só alcançável por request forjado do usuário contra os próprios dados (exigência 4) | surgir caminho de UI que envie o par divergente |
| fórmula de saldo de investimento replicada em 4 sites | `queries/investments.ts:44,234`, `queries/goals.ts:74`, `actions/investments.ts:72` | as quatro dão o mesmo valor — duplicação sem divergência | qualquer uma divergir |
| `copyFixedExpensesFromPrevMonth` vs. cron de rollover | `actions/transactions.ts:222`, `api/cron/rollover-fixed-expenses/route.ts:49` | mesmos 6 campos, mesmo `paid: false`; a diferença de comportamento é documentada em `.claude/domain.md` | os inserts divergirem em campo |

Duas dessas linhas escondem um sinal que **não** está morto e vale registro separado: `formatGroupDate` duplicado é a única razão pela qual `HistoricoClient` e `TransactionList` importam `format`/`ptBR` direto do `date-fns` em vez do wrapper `fmt` de `lib/utils/date.ts:20`; e `getInvestmentBalances` é N+1 (1 + 2×tipos) rodando em todo load de `/dashboard` e `/registro`, com o precedente batch já existindo no repo (`getGoalsWithProgress`, `goals.ts:47-70`). Os dois viram issue no dia em que alguém medir — não antes.

## Ferramental

Descoberto de novo do zero em quatro execuções diferentes. A sessão da Routine **não tem `node_modules` instalado**, o que remove a checagem mais forte do PASSO 3.5 ("rode o código; se não falhar, o achado morre"). O que funciona sem instalar nada:

- **Árvore de acessibilidade real** (foco de quarta): o Chromium do Playwright está em `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; subir com `--headless=new --remote-debugging-port=N` e chamar `Accessibility.getFullAXTree` via CDP pelo `WebSocket` nativo do Node 22. Foi assim que a #75 mediu papéis e a #106/#107 mediram nome e estado — e foi assim que morreu o candidato do `MultiselectDropdown`, cuja hipótese era citável em spec e falsa no motor real. Custa ~5 min e não erra.
- **Comportamento real de uma dependência** (foco de terça): `npm pack <pacote>@<versão>` + `tar xzf`, em vez de supor pelo README. Foi como se confirmou que o `lucide-react@1.8.0` emite `aria-hidden="true"` nos ícones.
- **Provar que o banco rejeita uma entrada**: `npm ci` + `initdb` num Postgres local, extraindo o statement com `QueryBuilder.toSQL()` do Drizzle e executando para ver o `22P02` de verdade. Custou ~10 min na #110 e é repetível para qualquer achado cuja evidência seja "o Postgres estoura".
- **Custo de bundle** (foco de terça): o bullet "pacote pesado em Client Component" exige custo mensurável, e a única medição válida é `npm run build` + inspeção dos chunks por marcador exclusivo do pacote. São ~2 min antes de poder afirmar qualquer coisa — e foi o que matou os candidatos do `date-fns/locale` e do `zod`, ambos tree-shaken na prática.
- **Gate existente com escopo declarado é fonte de achado.** O que um gate *não* mede costuma estar escrito na mensagem do commit que o criou: `57a83f4` diz "3 tokens × 3 fundos × 2 temas", e rodar a mesma maquinaria contra os pares fora daquele recorte produziu a #76.

## Vazão por área

Auditar uma área cujo backlog anterior ainda não foi mergeado rende zero: em 2026-08-25 a terça fechou com 0 issues tendo 3 issues abertas (#71, #101, #102) e 3 PRs em voo (#104, #111, #112) na mesma área. O gargalo ali é aprovação/merge, não descoberta. Se a área do dia tiver fila própria não drenada e a varredura não produzir nada, registre isso na #45 e considere ceder o slot para a área com fila mais curta — respeitando a rotação no ciclo seguinte.

---

## Rotação de foco por dia da semana

Timezone `America/Sao_Paulo`. Auditar **apenas** a área do dia — profundidade em 2 arquivos vale mais que varredura em 40.

### Segunda — Camada de dados e criptografia
`lib/queries/`, `lib/actions/`, `lib/db/`. Categorias 1 e 2 acima. Comece pelas queries sem cobertura de teste: `getAnnualOverview` e `getCreditAccounts` hoje não têm nenhuma.

### Terça — Dependências e supply chain
47 pacotes diretos e alertas de segurança abertos no Dependabot. Procure o que o Dependabot não reporta:
- Vulnerabilidade **alcançável** a partir do código do app vs. presa em devDependency que nunca roda em produção — a diferença muda a prioridade e o Dependabot não a faz
- Dependência declarada e não usada, ou usada só num arquivo que poderia sair
- Pacote pesado importado inteiro em Client Component quando só uma função é usada (custo de bundle real, mensurável)
- Versão presa por peer dependency que bloqueia upgrades em cadeia
- Duplicata de função já existente em `lib/utils/`
- `overrides`/`resolutions` cuja razão de existir não esteja no commit que os introduziu — ou que o `git log` mostre já resolvidos (no-op) sem terem sido removidos. Não peça comentário no `package.json`: JSON não aceita comentário, e a justificativa mora na mensagem de commit (`9a2b0b4` é o exemplar do repo)

Aponte a versão-alvo e o que quebra ao subir. Não abra issue que apenas replica o alerta do Dependabot.

### Quarta — Acessibilidade
Semântica, ordem de foco, navegação por teclado, contraste, ARIA incorreta. Atenção a dialogs e drawers (foco preso e devolvido ao fechar), `RowActions` e menus kebab, e ao modo escuro — o contraste precisa passar nos dois temas.

### Quinta — Tipagem e contratos
Tipos que são verdade sintática e mentira semântica: a assinatura diz `string` mas o valor é ciphertext, id não validado, ou mensagem que não sobrevive à fronteira de Server Action. Categorias 3 e 4 acima. Prefira a correção que faz o compilador impedir a recaída.

### Sexta — Arquitetura e acoplamento
Categoria 5 acima. Dependência circular, camada vazando (page fazendo trabalho de `lib/queries/`), duplicação estrutural.

Comece em `app/**/page.tsx` e nos componentes que **recebem** resultado de query — não em `lib/`. O acoplamento mais caro encontrado nesta rotação foi sempre page/componente reimplementando o que `lib/` já calcula (#113, #114). A exigência 7 obriga a olhar o consumidor de todo achado; aqui o rendimento vem do inverso — partir do consumidor e voltar para a query.

Antes de julgar um comportamento como errado, leia o `docs/<domínio>/05-roadmap.md` da área. Achado que contradiz decisão já registrada ali vale muito mais que achado que abre discussão de produto — foi o que transformou o #113 de "acho que devia ser assim" em "a implementação contradiz o que ficou decidido".

---

## Exigências de todo achado

Valem em qualquer dia, independentemente do foco.

1. **Evidência no código, não em tese.** Caminho e linha, trecho real, e por que é problema *aqui*.
2. **Tentativa de falsificação registrada.** Antes de abrir, tente derrubar o próprio achado: leia o schema, rode `git log -S` no trecho para ver se foi decisão deliberada, levante a convenção do repo. Se a hipótese sobreviver, registre o que foi verificado. Se morrer, não abra.

   Quando o achado depende do comportamento de **artefato de terceiro** — uma dependência, o diff de um PR do Dependabot, o código dentro de `node_modules` — a falsificação é ler o artefato, não raciocinar sobre o que o nome ou o título sugere. Dois candidatos de 2026-08-11 morreram exatamente aí: o título do PR #62 citava só a versão 1.x e o diff do lockfile subia as três cópias; e mover `@serwist/next` para `devDependencies` parecia seguro até `node_modules/next/dist/server/next.js:220` mostrar que o Next carrega `next.config` no boot do servidor de produção, não só no build. Nos dois casos a hipótese era plausível, bem-formada, ancorada em precedente ratificado — e falsa.
3. **Nota de cobertura.** Diga se existe teste que pegaria isso — e, se não existe, qual caso específico cobriria. Isso substitui "faltam testes" como issue própria. O caso proposto precisa incluir a entrada que **só a correção certa rejeita**: se o teste também passaria com a implementação errada mais provável, ele não cobre nada — a suíte fica verde sobre o furo e a revisão perde o único sinal automático que tinha.

   **Gate automático conta como teste.** O que importa é a propriedade — falhar hoje e não passar com a correção errada — não ser um `it()` sobre a função. Regra de lint, asserção sobre token de `globals.css` e asserção sobre string de classe são formas válidas, e às vezes as únicas: não há `@testing-library/react` no projeto, então propor "teste de render" em achado de componente significa propor a instalação da infra inteira, que é maior que qualquer correção e transforma a nota de cobertura na issue própria que a exigência 3 existe para evitar. Precedentes versionados: `__tests__/unit/focus-ring-contrast.test.ts` (contraste de token) e `__tests__/unit/paginas-publicas.test.ts` (rota × sitemap × rodapé).

   **Se já existe teste sobre a função defeituosa, diga o que ele está garantindo.** "Coberto" não é "protegido", e os dois modos de falha custam ao implementador se não estiverem na issue: o teste pode **afirmar o bug** (`historico-params.test.ts:34` assere `result.categorias` igual a `['uuid1','uuid2']`, que não são UUIDs; a #90 encontrou em `date.test.ts` uma asserção do comportamento errado com o caso de fronteira já nomeado) — e aí a correção certa deixa a suíte vermelha, o que precisa estar declarado como esperado, ou alguém vai "consertar" a correção. Ou o teste cobre **uma instância por vez** de uma propriedade que só quebra entre duas (a #91 testa `closingDay=31` em fevereiro e passa; o defeito só existe entre dois ciclos consecutivos). Nenhum dos dois aparece como lacuna de cobertura. Descobrir qual é o caso custa um `grep`.
4. **Impacto para quem, em que cenário.** Se não der para descrever um usuário afetado, o achado provavelmente não passa do teto de relevância.
5. **Custo estimado**: P (1 arquivo) / M (2-4) / G (estrutural).
6. **Helper nomeado, motivo declarado.** Quando a proposta depende de um helper ou schema específico, dizer *por que aquele* e não o similar mais óbvio do repo. Sem isso, quem implementa reusa o helper conhecido — que é o caminho natural e pode ser exatamente o errado.
7. **Superfície citada tem consumidor.** Antes de afirmar que algo "some da tela X", "não aparece no gráfico Y" ou "quebra o componente Z", `grep` pelo componente e confirme que ele é importado em algum lugar. Impacto declarado sobre tela que não é renderizada é ficção, e custa caro: quem implementa escreve teste para o caminho morto. Se a superfície não tem consumidor, ou o achado muda de impacto, ou o achado vira outro (o código morto em si).
8. **Achado multi-site diz quantos são — e fecha por inteiro.** Quando o achado se repete em N lugares, enumere os N no corpo, explicitamente. O PR que fecha ou cobre os N, ou lista na descrição quais ficaram de fora e por quê. `closes #N` num PR que cobre parte da lista é erro de contrato: use `refs #N` e deixe a issue aberta. Vale para quem audita (enumerar) e para quem revisa (conferir a lista antes de aprovar o `closes`).

   **O fechamento manual está sujeito à mesma regra.** Issue multi-site só fecha quando a lista da seção **Onde** estiver inteira; fechar com itens pendentes exige comentário dizendo quais e por quê. A exigência nasceu governando PR e não alcançava o botão de fechar da UI — e o efeito é idêntico: em 2026-08-10 a #34 foi fechada à mão, sem PR vinculado e sem comentário, com dois sites ainda em produção e o último registro escrito na issue dizendo o contrário ("devolvendo a issue à fila para esse restante").

   **Enumere por conteúdo, não por caminho.** Caminho apodrece: `EditChargeDialog.tsx` deixou de existir três dias depois de ser listado na #34, e quem fizesse `grep` pelo nome acharia zero ocorrências e concluiria que estava resolvido. Enumere pela mensagem, pelo predicado, pela chamada — e reconfira por eles.

   **Site sem consumidor não vota.** Quando a enumeração alimenta o argumento da categoria 5 ("a maioria segue uma forma, a minoria é o bug"), marque quais dos N são renderizados: código morto entra como precedente do predicado, não como tela afetada. E conte a maioria **no mesmo recorte do achado**, não no repo inteiro — na #106 o placar global era 19 × 9, confortável, enquanto no subconjunto que importava (o lápis de "editar") era empate 6 × 6. O placar global transforma uma falha normativa, que se sustenta sozinha, numa alegação de convenção que não se sustenta.

Zero achados com evidência suficiente = zero issues. Issue fraca é pior que issue nenhuma.

---

## Calibragem

O retorno de cada execução vai para a **issue #45** ("Calibragem da auditoria automática"), que é permanente e não deve ser fechada. Ao encerrar, comente lá o balanço do dia no formato descrito na própria issue: foco, issues abertas, candidatos mortos no PASSO 3.5 e qual das quatro checagens derrubou cada um.

Comentar é obrigatório quando houve sinal — issues abertas, candidatos descartados, ou um critério que se mostrou vago. Dia sem nenhum dos três não precisa de comentário.

Isso não é burocracia: **o que a auditoria decide NÃO reportar é o dado mais valioso que ela produz**, e é o único que não deixa rastro em lugar nenhum. Issue aberta fica no GitHub; achado descartado some com a sessão.

A divisão é:

- **Issue #45 é a caixa de entrada.** Um comentário por execução, barato, sem PR. É onde o sinal bruto se acumula.
- **Este arquivo é o livro-razão.** Só recebe mudança de critério já ratificada, via PR, quando um padrão se repetiu o bastante para virar regra.

Um achado descartado uma vez é ruído. O mesmo tipo descartado três vezes é critério mal escrito — e aí sobe para cá.

A regra das três repetições vale para achado **descartado**. Achado que sobreviveu à auditoria e ainda assim virou bug no PR de implementação é outra classe: um caso basta para virar regra, porque o custo já foi pago em código mergeado.

**Essa distinção já falhou uma vez, então ela é operacional, não filosófica.** Nos ciclos de 2026-08-06 e 2026-08-07 a auditoria identificou corretamente as duas falhas de implementação, escreveu a regra proposta na #45 — e mesmo assim segurou as duas invocando a regra das três repetições, que não se aplicava. Ficaram paradas até uma revisão humana promover. Ao encerrar uma execução, a pergunta é: *o custo já foi pago em código mergeado?* Se sim, a regra sobe no mesmo ciclo; a #45 recebe o registro, mas não é onde a regra espera.

### Histórico de calibragem

Mudanças de critério já ratificadas. Não registrar aqui o balanço diário (vai para a #45) — só o que mudou de fato nas regras acima e por quê.

- **2026-07-31** — Rotação ajustada com base nas 6 primeiras issues: 4 de 6 achados caíam fora dos critérios então escritos, todos concentrados em dados/cripto/validação. "Cobertura de testes" saiu de segunda e virou exigência transversal (item 3 acima), já que a auditoria naturalmente já reportava cobertura em todos os achados. "Performance de render" saiu de terça e deu lugar a dependências: o app é majoritariamente Server Components, e há alertas de segurança abertos sem triagem. Nenhum achado reprovado ainda.

- **2026-08-01** — Exigência 3 passou a pedir explicitamente a entrada que só a correção certa rejeita, e entrou a exigência 6 (helper nomeado, motivo declarado). Origem: primeiro achado que sobreviveu à auditoria e mesmo assim virou bug na implementação. A issue #32 propunha `z.string().date()`; o PR #39 (`08abe34`) substituiu por `dateSchema` de `lib/validations/utils.ts` e passou em lint, typecheck e 358 testes — com o bug intacto para `?de=2025-02-29` e `?de=2025-06-31`, porque `dateSchema` faz overflow silencioso de calendário (gotcha no `CLAUDE.md` desde `623e757`, seis semanas antes). Os dois casos de teste que o PR escolheu (`abc`, `2025-13-99`) eram justamente os que o validador errado já barrava, então nada no CI podia acusar. A #32 apontava para `lib/validations/utils.ts` — o arquivo do helper errado — sem justificar o helper que nomeava. A revisão humana pegou; a correção veio em `0f0770b`.

- **2026-08-06** — Entrou a exigência 8 (achado multi-site fecha por inteiro ou declara o resto). Origem: segundo caso da classe "achado bom, revisão aprovada, bug sobrevive". A issue #34 enumerava 5 componentes exibindo `err.message` que nunca chega ao usuário em produção; o commit `34d9690` corrigiu 1 (`createFaturaPayment`), escreveu `closes #34` no rodapé, e a issue fechou sozinha. O texto do commit descreve corretamente o que fez — o erro é o `closes` afirmar mais do que o diff entrega, com ninguém entre a issue e o merge conferindo a lista. A lacuna só apareceu porque a auditoria do dia seguinte foi reler uma issue **fechada** procurando duplicatas. A #34 foi reaberta e o fatiamento registrado nela.

- **2026-08-07** — Entrou a exigência 7 (superfície citada tem consumidor). Origem: a issue #36 declarou impacto em duas telas — "some do gráfico de evolução e do Panorama" — e o gráfico de evolução não existe na UI: `MonthlyEvolutionChart` está definido em `components/charts/MonthlyEvolutionChart.tsx` e nunca é importado, enquanto `getMonthlyEvolution` roda em todo load do dashboard (`lib/queries/dashboard.ts:231`) com o resultado descartado. Metade do impacto declarado era ficção e ninguém pegou: nem a auditoria, nem a revisão, nem o PR #55, que ainda escreveu 63 linhas de teste de integração para a metade morta. A checagem que teria evitado custa um `grep`. O código morto virou a issue #58.

- **2026-08-25** — Revisão dos 14 comentários acumulados na #45 (2026-08-04 a 2026-08-25). Seis mudanças, todas com o gatilho já satisfeito e nenhuma promovida antes por subcontagem:

  **Nova seção "Candidatos já falsificados"**, e é o achado principal da revisão. Onze candidatos morreram em duas ou mais execuções independentes — 24 re-derivações no total — sempre pela mesma checagem, porque o registro delas mora na #45 e ninguém relê a #45 durante uma execução. O arquivo afirma que "o que a auditoria decide NÃO reportar é o dado mais valioso que ela produz" e, até aqui, era o único dado que ele não guardava. A seção também absorve as duas exceções úteis (`formatGroupDate` e o N+1 de `getInvestmentBalances`), que não estão mortas — estão à espera de medição.

  **Categoria 2, `revalidatePath`** — qualificado para "e que é servido de cache". Quatro repetições (08-07, 08-10, 08-17, 08-24), não uma: o balanço de 08-24 concluiu "uma repetição, não três" sem cruzar com os anteriores. O critério foi escrito em Next 14; hoje é Next 16 sem `staleTimes`, e em rota dinâmica a ausência da chamada não produz render obsoleto. Como estava, convidava a abrir issue que morria na exigência 4.

  **Rotação de terça, `overrides`** — quatro repetições (08-04, 08-11, 08-18, 08-25). O critério pedia comentário num arquivo JSON, que é incapaz de aceitar comentário: marcava todo override de todo repo, para sempre. Passou a mirar o que tem valor real (override zumbi ou sem razão no commit que o introduziu).

  **Exigência 8 alcança fechamento manual** — promoção imediata, não sujeita às três repetições, pela regra do próprio arquivo: o custo já foi pago em código mergeado. A #34 foi fechada à mão em 2026-08-10, sem PR e sem comentário, com dois sites vivos em produção. É a terceira vez que a mesma issue perde escopo em silêncio, e o terceiro modo de falha distinto — a exigência 8 governava o que um PR pode afirmar e não alcançava o botão de fechar. Entraram junto os dois adendos que a #34 e a #106 expuseram: enumerar por conteúdo (caminhos apodrecem — `EditChargeDialog.tsx` sumiu três dias depois de ser listado) e contar a maioria no recorte do achado (19 × 9 no repo virava empate 6 × 6 no subconjunto que importava).

  **Exigência 3 ganhou duas sub-regras.** "Gate automático conta como teste" (08-05): não há `@testing-library/react` no projeto, então exigir `it()` de render em achado de componente transforma a nota de cobertura na issue própria que a exigência existe para evitar. E "diga o que o teste existente está garantindo" (08-14, 08-20): duas ocorrências de "coberto mas não protegido" em formas distintas — asserção que **afirma o bug** e propriedade testada uma instância por vez. Nenhuma aparece como lacuna de cobertura; descobrir qual é o caso custa um `grep` e muda o que a issue precisa pedir.

  **Exigência 2 passou a nomear artefato de terceiro.** Ela dizia "leia o schema, rode `git log -S`" — todos artefatos *deste* repo. Em 08-11 dois candidatos morreram por ler o diff do lockfile do PR e o código dentro de `node_modules`; sem essa leitura, um deles teria virado issue confiante recomendando uma mudança que quebra o boot do servidor de produção.

  Entraram também, sem força de critério: a seção **Ferramental** (como medir sem `node_modules`, redescoberto do zero em quatro execuções) e a nota de **vazão por área**; e a rotação de sexta passou a começar em `app/**/page.tsx` com leitura prévia do `docs/<domínio>/05-roadmap.md`.
