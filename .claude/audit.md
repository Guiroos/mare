# Critérios de auditoria deste projeto

Citado pelo `CLAUDE.md` **sem** `@` — não carrega em sessão de desenvolvimento local; leia sob demanda. Usado pelas Routines `auditoria`, `review` e `calibragem` (prompts em `.claude/routines/`) e por qualquer revisão de código manual (`/code-review`) neste repositório.

O prompt da Routine (`.claude/routines/auditoria.md`) define o **processo** (dedup, memória, teto de issues, formato). Este arquivo define o **julgamento**: o que conta como bug aqui, o que ignorar, e onde procurar em cada dia. Os dois são versionados desde a v2 (2026-11-24) e mudam por PR.

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
- `Number()` sobre campo `decimal` **nullable** sem `?? 0`, ou sobre valor possivelmente cifrado (`enc:…` vira `NaN`). Sobre coluna `notNull` em plaintext, `Number(x.amount)` ≡ `toAmount(x.amount)` (`toAmount` é `Number(v ?? 0)`): quebra de convenção, não bug — morreu 5× assim entre 08-29 e 10-02

Referência: `.claude/db.md`, `.claude/domain.md`.

### 3. Fronteiras de entrada sem validação

- `searchParams` ou parâmetro de route handler indo direto para uma query sem passar por schema Zod — id não-UUID chega ao Postgres e vira 500 onde deveria ser 404/400 (issue #33)
- String crua da URL interpolada em header de resposta sem sanitizar (issue #32: `Content-Disposition`)
- Action que referencia `categoryId`/`accountId`/`personId` do cliente sem `assertOwns*` antes
- Rota de cron sem `timingSafeEqual` ou que não recusa quando `CRON_SECRET` é indefinido
- Validação que só existe no cliente para estado que a UI consegue produzir **sem forjar**: aba desatualizada, dialog aberto com dado velho, duplo clique, duas abas. Isso **não** é "request forjado" (ver "O que NÃO reportar") — o PR #217 corrigiu três candidatos que a rotina tinha matado por essa confusão: splits sem validação no servidor (morto 4×, virou `cb21d2b`), `createDebtPayment` re-quitando cobrança já quitada pela aba velha (morto 3×, virou `0ed8cd2`) e o ajuste de conciliação de `updateDebtEntry` (morto 2×, mesmo commit)

Referência: `.claude/auth.md`.

### 4. Erro que não chega ao usuário — ou chega errado

- `catch {}` sem log e sem feedback
- `catch` que afirma uma causa específica que o código não conhece — pior que mensagem genérica, porque manda o usuário para o lado errado (issue #35: "item em uso" para falha de rede)
- Mensagem de `throw new Error()` em Server Action consumida como `err.message` no cliente: em build de produção o React descarta a mensagem original (issue #34). Falha esperada deve virar retorno tipado, não exceção
- Dialog de **formulário** que fecha no `catch` — esconde a falha, sugere sucesso e descarta o que o usuário digitou. Confirmação de exclusão sem campo (`DeleteButton`, `RowActions`, diálogos de exclusão de pagamento) fecha no `catch` **depois** de `toast.error` + `console.error`: forma do repo desde a #35, não achado (morreu 3×: 09-10, 09-24, 10-01)

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
- Vulnerabilidade de dependência que já tem PR do Dependabot aberto **com CI verde e mergeável** — o valor está no que o Dependabot **não** pega (ver foco de terça). PR do Dependabot vermelho ou em conflito é ele próprio achado de terça (lido ao pé da letra, a versão anterior suprimiria a #164 e a #211)
- Achado cuja correção depende de decisão de produto **não tomada e não delimitada**. Quando `docs/<domínio>/` **delimita** a decisão (descreve o caso e o trade-off) sem tomá-la, abra como pergunta, com `[pergunta]` no título: em 10-23 o "Saldo do ciclo" morreu por esta regra e em 10-30 virou a #215 citando o mesmo `docs/regime-fatura/01-contexto.md`
- Defeito alcançável **só** por payload forjado pelo próprio usuário contra os próprios dados (devtools, `curl` com o próprio cookie) — o atacante e a vítima são a mesma pessoa. Não vale como dispensa quando: o estado é alcançável pela UI sem forjar (aba velha, dialog obsoleto, duplo clique — ver categoria 3); o valor chega por URL que circula (#110); a superfície é pública sem sessão (`/e/[token]`); ou o dano atravessa usuários. Morreu por esta regra em 12 execuções (08-27 a 11-02) — e três delas eram o caso da aba velha, não forjado

---

## Candidatos já falsificados

Consultar **antes** de gastar a falsificação do PASSO 3.5. Cada linha aqui já morreu em pelo menos duas execuções independentes. Primeira leva (2026-08-25): 11 candidatos, ~24 re-derivações. Segunda leva (2026-11-24): 24 candidatos, ~90 re-derivações entre 08-26 e 11-24 — quase todos registrados como "primeira ocorrência" porque nenhuma execução relia a #45. Recandidatar um deles sem trazer fato novo é gastar um ciclo para chegar à mesma conclusão.

Absolvição registrada no corpo de uma issue (ex.: a verificação 2 da #41 absolve `deleteInstallmentGroup`) não chega sozinha aqui — quem a encontrar de novo registra a linha na próxima calibragem.

Isso não é uma lista de "não olhe": é uma lista de **o que já foi verificado e com qual evidência**. A coluna final diz o que precisaria mudar para o candidato voltar a valer.

| Candidato | Onde | Morre por | Volta a valer se |
| --- | --- | --- | --- |
| `notInArray(accountId, creditAccountIds)` some com linha de `accountId` NULL | `dashboard.ts`, `panorama.ts` | `accountId` é `.notNull()` em `transactions` e `fixedExpenses` (`lib/db/schema.ts`) | alguma migration tornar a coluna nullable |
| `overrides` do `package.json` sem justificativa | `package.json` | `9a2b0b4` documenta os dois na mensagem, inclusive o no-op do `form-data` (re-derivado 5×: 09-01 a 10-13) | entrar override novo cujo commit não explique, ou o motivo de um dos dois sumir do lockfile (aí é "zumbi" — bullet de terça) |
| `revalidatePath` ausente nas actions de `paymentAccounts` | `lib/actions/categories.ts` | rota dinâmica sob `staleTimes.dynamic: 0` — sem render obsoleto demonstrável (ver categoria 2) | o projeto passar a configurar `staleTimes` ou a rota virar estática |
| `TxItem` com `onClick` em `<div>` sem `role`/`tabIndex` | `TxItem` em `components/ui/tx-list.tsx` | nenhum dos 2 call sites passa `onClick` (`TripEntriesList` ×2 — conferido 2026-10-09, depois que o redesenho do dashboard removeu `CategoryGroupProgress`) | algum call site passar `onClick` |
| `CategoryPicker` variante `grid` sem estado acessível | `components/forms/transaction/CategoryPicker.tsx` (variante `grid`) | variante não renderizada: os 5 call sites e o default passam `'combobox'` | alguém passar `categoryVariant="grid"` |
| `?cycleAccount=` cru sem validação de UUID | `app/(app)/dashboard/page.tsx` (`activeAccount`) | `creditAccounts.find((a) => a.id === cycleAccount)` — array em memória, não chega ao Postgres | o parâmetro passar a alimentar uma query |
| `settleCharge`/`createDebtPayment` aceitam `personId` divergente do da cobrança | `debtors.ts` | ownership correto; só alcançável por request forjado do usuário contra os próprios dados (exigência 4) | surgir caminho de UI que envie o par divergente |
| fórmula de saldo de investimento replicada em 4 sites | `getInvestmentBalances`, `buildPatrimonyTimeline`, `getGoalsWithProgress`, `archiveInvestmentType` | as quatro dão o mesmo valor — duplicação sem divergência | qualquer uma divergir |
| `Number(x.amount)` em vez de `toAmount` | `lib/queries/`, componentes | `toAmount` ≡ `Number(v ?? 0)` e as colunas são `notNull` (ver categoria 2) | campo nullable sem `?? 0`, ou `toAmount` ganhar lógica própria |
| Dialog/Drawer sem `*Title` | `components/**` | paridade 1:1 `Content`↔`Title` em 31–36 arquivos (6×, 08-26 a 10-07) | arquivo com `Content` sem `Title` — melhor virar gate que varredura |
| `<th>` sem `scope` / mês em `<td>` | tabelas de `/panorama`, `/parcelas` | CDP: `columnheader` é inferido; `scope` é no-op ali (4×) | tabela com cabeçalho nos dois eixos |
| `updateFeedbackStatus(id)` sem validação de UUID | `lib/actions/admin.ts` | admin-only, id vem do render (5×) | id de fonte não renderizada, ou mais de um admin |
| `deleteInstallmentGroup` apaga `debtorEntries` sem `eq(userId)` | `lib/actions/transactions.ts` | os `txIds` já vêm escopados por `userId` — verificação 2 da #41 (5×) | o SELECT dos `txIds` perder o filtro |
| `.parse()` descartado / `data.*` cru (`upsert*`, `tripId ''`) | `lib/actions/` | nenhum schema usado tem `transform`; os callers mandam `result.data` (6×) | schema usado ganhar `transform`/`preprocess` (`optionalUuidSchema` já é `preprocess` — conferir quem o usa) |
| `positiveAmountSchema` `parseFloat` × `Number` | `lib/validations/utils.ts` | só o `CurrencyInput` produz o valor, com `toFixed(2)` (4×) | campo de valor fora do `CurrencyInput` |
| `fetchMoreHistorico` com `tipos`/`cursor` crus | `lib/actions/historico.ts` | não alcançam SQL (4×) | passarem a alimentar query |
| Base de capital do resgate `'reinvest'` não desconta resgates anteriores | `createWithdrawal`/`updateWithdrawal` | decisão registrada em `docs/investimentos/08` e `09` (5×) | decisão revista |
| `inArray` sem guard de array vazio | `lib/queries/`, `lib/actions/` | 27–28 sites guardados, nenhum sem guard (6×) | site novo sem guard — candidato a gate, sai da varredura manual |
| Predicado de fatura divergente entre `getAnnualOverview`, `getDashboardData` e `getAnnualExpensesByGroup` | `lib/queries/` | os três são equivalentes desde a #36 (6×) | algum divergir |
| `updateAutoRollover` sem `encryptedDek` | `lib/actions/` | `getDekForUser` faz upsert com `COALESCE` em `keys.ts` (3×) | `getDekForUser` perder o `COALESCE` |
| `investmentTypes.goalId` escrito só pelo seed | schema / `lib/queries/investments.ts` | exigência 7: nenhum consumidor lê o campo (3×) | algum consumidor passar a ler |
| Fechar dialog no `catch` | `DeleteButton`, `RowActions`, `PaymentWithIncomeDeleteDialog` | `toast.error` antes de fechar; forma da #35 (ver categoria 4) (3×) | site sem toast |
| `dateSchema`/`yearMonthSchema` com overflow de calendário | `lib/validations/` | só `<input type=date/month>` produz o valor; a superfície de URL fechou na #56 (3×) | fonte nova de data |
| `deleteX(id)` / `archivePerson` sem `uuidSchema` | `lib/actions/` | só alcançável forjado (3×) | id passar a vir de fonte não renderizada |
| `createWithdrawal` confia em `investmentTypeName` | `lib/actions/investments.ts` | nome derivado de id validado (3×) | caller novo |
| "Orçamento N% usado" contando categorias sem orçamento | dashboard | mesma fórmula do `SummaryCards` anterior (`a7da176^`); decisão de produto (3×) | decisão tomada |
| "Rendimento pendente" contando tipos arquivados | `PendencyBanner` | exigência 4 (2×) | — |
| Avulsa por calendário × parcela por ciclo | dashboard / Histórico | duas decisões documentadas (#98, #152, #203) (2×) | unificação decidida |
| `/contas` com `hasCreditAccounts` próprio | `app/(app)/contas` | é a forma canônica da #36 (2×) | — |
| `aria-label` idêntico por linha ("Excluir…", "Ações", "Marcar como pago") | listas | convenção; sem medição com leitor de tela (3×) | medição real com AT |
| Skip link (2.4.1) / `Combobox` por teclado | layout / `combobox.tsx` | H69/ARIA11 suficientes; a #75 completou o `Combobox` (2× cada) | caso de teclado sem tecnologia assistiva |
| Deps: sem uso / importada sem declarar / peso de `write-excel-file` / integridade do lockfile / esbuild do `drizzle-kit` | `package.json` | gateado (`__tests__/unit/dependencies.test.ts`, `npm ls`) ou medido limpo (sem uso: 7×; peso: 4×; integridade: 3×) | dependência nova ou removida |
| `copyFixedExpensesFromPrevMonth` vs. cron de rollover | `copyFixedExpensesFromPrevMonth`, `api/cron/rollover-fixed-expenses/route.ts` | mesmos 6 campos, mesmo `paid: false`; a diferença de comportamento é documentada em `.claude/domain.md` | os inserts divergirem em campo |

A linha do `installmentAmount` saiu da tabela em 2026-11-24: voltou a valer em 10-08 e é a #195.

Uma dessas linhas esconde um sinal que **não** está morto e vale registro separado: `getInvestmentBalances` é N+1 (1 + 2×tipos) rodando no load de `/registro` e `/investimentos` e a cada abertura de dialog de registro/edição via `getRegistrationFormData` (que no mesmo `Promise.all` chama `getDashboardData` inteiro), com o precedente batch já existindo no repo (o `Promise.all` bulk de `getGoalsWithProgress`). Vira issue no dia em que alguém medir — não antes. Junta-se a ele, também sem medição, `getGoalsWithProgress` chamado 2× por request em `/viagens` (09-28, 10-02). (A outra linha, `formatGroupDate` duplicado em `HistoricoClient`/`TransactionList`, saiu da tabela em 2026-10-09: as duas cópias viraram `formatDayGroupLabel` em `lib/utils/date.ts`.)

## Ferramental

**A sessão da Routine roda código.** Até 2026-08-25 este arquivo dizia o contrário ("não tem `node_modules`"), e o texto custou caro: em 10-02 uma execução concluiu "rodar o código indisponível" lendo esta seção, enquanto oito outras (09-01 a 10-21) rodaram `npm ci`/`build` sem problema. O que funciona:

- **`npm ci` (~1–2 min) e `npm run build`** funcionam pelo proxy. Rode numa cópia no scratchpad quando for mutar código. O sandbox tem Node 22/npm 10; o CI usa Node 24/npm 11 — para comparar comportamento de lockfile, `npm install npm@11` no scratchpad e use esse binário (em 09-22 a divergência 10 × 11 quase gerou conclusão falsa).
- **Clone raso.** O clone vem com ~325 commits. `git rev-parse --is-shallow-repository`; se `true`, `git fetch --unshallow origin` antes de `git log -S`/`blame`/`cat-file`. Sem isso eles respondem com um commit de fronteira plausível, não com erro (08-27, 09-04, 09-29). Sem histórico, a fonte de intenção é `docs/<domínio>/`.
- **Réplica de função pura** em `node`/`tsx` para provar o valor que uma fórmula devolve (08-31, 10-02, 10-05, 10-16, 10-19).
- **Componente real no browser**: `esbuild --alias:@=.` empacotando o componente + Chromium do Playwright (`require('playwright')` funciona de qualquer diretório; o binário está em `/opt/pw-browsers/chromium-*` — não fixe a versão no texto, ela muda). CDP pelo `WebSocket` do Node: `Accessibility.getFullAXTree` para papel, nome e estado (#75, #106, #107); `document.activeElement` + `Input.dispatchKeyEvent` para foco e teclado (09-16); `Browser.downloadProgress` para download (10-01).
- **Comportamento real de uma dependência**: `npm pack <pacote>@<versão>` + `tar xzf`, e `diff -rq` entre a versão vulnerável e a corrigida (09-01, 10-27, 11-03). `npm audit --package-lock-only` sem instalar (09-08, 10-13).
- **Provar que o banco rejeita uma entrada**: `npm ci` + `initdb` num Postgres local, extraindo o statement com `QueryBuilder.toSQL()` do Drizzle e executando para ver o erro de verdade (~10 min na #110).
- **Custo de bundle**: `npm run build` + inspeção dos chunks por marcador exclusivo do pacote. Matou os candidatos do `date-fns/locale` e do `zod`, ambos tree-shaken na prática.
- **Medir também a correção.** Quando a proposta escolhe entre correções, meça a "correção errada mais provável" e mostre que ela falha (09-02, 10-21, 10-28) — é a evidência que a exigência 6 pede.
- **Bloqueado pelo proxy**: texto de advisory (`api.github.com/advisories`, `github.com/advisories` → 403; `osv.dev` recusado) e logs do Actions (redirecionam para blob da Azure). Contorno para CI: `git fetch origin pull/<n>/head` + `git worktree` + rodar os passos do workflow.

**Fontes de achado que se repetiram:**

- **Escopo declarado de correção anterior.** O que um gate, um PR ou uma issue fechada *não* cobriu costuma estar escrito no próprio artefato: `57a83f4` diz "3 tokens × 3 fundos × 2 temas" e o resto virou a #76; a #66 fechou um arquivo e deixou a regra viva (#160); as fechadas #76 e #53 levaram à #166; doc de correção (08-29), título da #41 (08-31), premissa de commit que o merge invalidou (09-08), exceção `oklch` sem gate de contraste (10-14).

## Vazão por área

Auditar uma área cujo backlog não foi aprovado rende issue que ninguém vai implementar. A nota anterior ("se a varredura não produzir nada, considere ceder") nunca disparou: ~11 registros de "considerar ceder" entre 09-01 e 11-03, zero cessões, e a fila de a11y chegou a 11 abertas. A regra agora é mecânica, aplicada no PASSO 1:

- **Backlog parado** = issues `claude-audit` abertas da label da área **sem** `claude-ready` e sem PR.
- **Backlog parado ≥ 5** → não procure achado novo na área. Revalide as abertas (o problema ainda existe? site novo? piorou? versão-alvo envelheceu?) e comente nelas com a seção **Onde** atualizada. O tempo que sobrar vai para o **slot livre**.
- **Slot livre** (backlog ≥ 5, ou área do dia esgotada sem achado): pegue o candidato "Fora da área" mais antigo dos balanços da #45 desde a última calibragem e audite-o, com a label da área **dona** e a origem declarada no corpo. Funcionou duas vezes sem regra (09-28 → #200, 10-16 → #210).

---

## Rotação de foco por dia da semana

Timezone `America/Sao_Paulo`. Auditar **apenas** a área do dia — profundidade em 2 arquivos vale mais que varredura em 40.

### Segunda — Camada de dados e criptografia
`lib/queries/`, `lib/actions/`, `lib/db/`. Categorias 1 e 2 acima. Pontos de partida que renderam: **actions de edição que regravam campo derivado** (`referenceMonth`, `investmentReturnCapital`, ajuste de conciliação — #148, #153, #186) e **coluna gravada sem leitor / filtro aplicado a só parte dos ramos** (#133, #134). O ponteiro anterior ("`getAnnualOverview` e `getCreditAccounts` não têm teste") era falso — `queries-panorama.test.ts` e `actions-form-data.test.ts` cobrem as duas — e foi seguido 6× sem render; "export sem consumidor" já é gate (`queries-sem-codigo-morto.test.ts`).

### Terça — Dependências e supply chain
Dependências diretas do `package.json` e alertas abertos no Dependabot. Procure o que o Dependabot não reporta:
- PR do Dependabot **vermelho ou em conflito** — é achado, não "coberto" (ver "O que NÃO reportar")
- Vulnerabilidade **alcançável** a partir do código do app vs. presa em devDependency que nunca roda em produção — a diferença muda a prioridade e o Dependabot não a faz
- Dependência declarada e não usada, ou usada só num arquivo que poderia sair
- Pacote pesado importado inteiro em Client Component quando só uma função é usada (custo de bundle real, mensurável)
- Versão presa por peer dependency que bloqueia upgrades em cadeia
- Duplicata de função já existente em `lib/utils/`
- `overrides`/`resolutions` cuja razão de existir não esteja no commit que os introduziu — ou que o `git log` mostre já resolvidos (no-op) sem terem sido removidos. Não peça comentário no `package.json`: JSON não aceita comentário, e a justificativa mora na mensagem de commit (`9a2b0b4` é o exemplar do repo)

Aponte a versão-alvo e o que quebra ao subir. Não abra issue que apenas replica o alerta do Dependabot. Versão-alvo de issue aberta que envelheceu (saiu patch novo, advisory novo) é comentário de "piorou" na issue, não issue nova (#156 re-alvejada em 09-29, 10-06 e 11-24). Checagens já gateadas ou medidas limpas estão na tabela de falsificados — não refaça sem dependência nova.

### Quarta — Acessibilidade
Semântica, ordem de foco, navegação por teclado, contraste, ARIA incorreta. Atenção a dialogs e drawers (foco preso e devolvido ao fechar), `RowActions` e menus kebab, e ao modo escuro — o contraste precisa passar nos dois temas.

### Quinta — Erro, contrato de Server Action e tipos que mentem
Categoria 4 primeiro, depois tipos. Pontos de partida:
- Action que devolve `void` ou lança em falha que o **usuário** provoca pela UI (conflito, estado que mudou, validação de negócio) — deveria ser `ActionResult` (`.claude/auth.md`)
- `ActionResult.code` que nenhum cliente lê, ou cliente que lê `message` de `throw` (#34)
- `catch` que afirma causa que o código não conhece (#35)
- Tipo que é verdade sintática e mentira semântica: `string` que é ciphertext, id não validado

A categoria 3 (URL, header, `searchParams`) só entra para superfície **nova** desde a última quinta (`git log --since=<quinta passada> -- 'app/**/route.ts' 'app/**/page.tsx'`): a superfície antiga foi fechada pelas #31, #32, #33, #56, #82, #83 e #110, e a quinta rendeu zero no foco de 10-01 a 10-29 varrendo-a de novo. Prefira a correção que faz o compilador impedir a recaída.

### Sexta — Arquitetura e acoplamento
Categoria 5 acima. Dependência circular, camada vazando (page fazendo trabalho de `lib/queries/`), duplicação estrutural.

Comece em `app/**/page.tsx`, no Client Component que ela monta e nos componentes que **recebem** resultado de query — não em `lib/`. O acoplamento mais caro encontrado nesta rotação foi sempre page/componente reimplementando o que `lib/` já calcula (#113, #114). A exigência 7 obriga a olhar o consumidor de todo achado; aqui o rendimento vem do inverso — partir do consumidor e voltar para a query.

Antes de julgar um comportamento como errado, leia `docs/<domínio>/` da área — o roadmap **e** os docs de correção já implementada (a evidência que decidiu achados veio de `docs/panorama/01-…`, `docs/investimentos/07`–`09`, `docs/devedores/08-…`, `docs/regime-fatura/01-contexto.md`, não só do `05-roadmap.md`). Achado que contradiz decisão já registrada ali vale muito mais que achado que abre discussão de produto — foi o que transformou o #113 de "acho que devia ser assim" em "a implementação contradiz o que ficou decidido".

---

## Exigências de todo achado

Valem em qualquer dia, independentemente do foco.

1. **Evidência no código, não em tese.** Caminho e linha, trecho real, e por que é problema *aqui*.
2. **Tentativa de falsificação registrada.** Antes de abrir, tente derrubar o próprio achado: leia o schema, rode `git log -S` no trecho para ver se foi decisão deliberada, levante a convenção do repo. Se a hipótese sobreviver, registre o que foi verificado. Se morrer, não abra.

   Com clone raso, `git log -S` não falha — devolve o commit de fronteira. Rode `git fetch --unshallow` antes (ver Ferramental).

   Quando o achado depende do comportamento de **artefato de terceiro** — uma dependência, o diff de um PR do Dependabot, o código dentro de `node_modules` — a falsificação é ler o artefato, não raciocinar sobre o que o nome ou o título sugere. Dois candidatos de 2026-08-11 morreram exatamente aí: o título do PR #62 citava só a versão 1.x e o diff do lockfile subia as três cópias; e mover `@serwist/next` para `devDependencies` parecia seguro até `node_modules/next/dist/server/next.js:220` mostrar que o Next carrega `next.config` no boot do servidor de produção, não só no build. Nos dois casos a hipótese era plausível, bem-formada, ancorada em precedente ratificado — e falsa.
3. **Nota de cobertura.** Diga se existe teste que pegaria isso — e, se não existe, qual caso específico cobriria. Isso substitui "faltam testes" como issue própria. O caso proposto precisa incluir a entrada que **só a correção certa rejeita**: se o teste também passaria com a implementação errada mais provável, ele não cobre nada — a suíte fica verde sobre o furo e a revisão perde o único sinal automático que tinha.

   **Gate automático conta como teste.** O que importa é a propriedade — falhar hoje e não passar com a correção errada — não ser um `it()` sobre a função. Regra de lint, asserção sobre token de `globals.css` e asserção sobre string de classe são formas válidas, e às vezes as únicas: não há `@testing-library/react` no projeto, então propor "teste de render" em achado de componente significa propor a instalação da infra inteira, que é maior que qualquer correção e transforma a nota de cobertura na issue própria que a exigência 3 existe para evitar. Precedentes versionados: `__tests__/unit/focus-ring-contrast.test.ts` (contraste de token) e `__tests__/unit/paginas-publicas.test.ts` (rota × sitemap × rodapé).

   **Se já existe teste sobre a função defeituosa, diga o que ele está garantindo.** "Coberto" não é "protegido", e os dois modos de falha custam ao implementador se não estiverem na issue: o teste pode **afirmar o bug** (`historico-params.test.ts` asseria `result.categorias` igual a `['uuid1','uuid2']`, que não são UUIDs, até a #110; a #90 encontrou em `date.test.ts` uma asserção do comportamento errado com o caso de fronteira já nomeado) — e aí a correção certa deixa a suíte vermelha, o que precisa estar declarado como esperado, ou alguém vai "consertar" a correção. Ou o teste cobre **uma instância por vez** de uma propriedade que só quebra entre duas (a #91 testa `closingDay=31` em fevereiro e passa; o defeito só existe entre dois ciclos consecutivos). Nenhum dos dois aparece como lacuna de cobertura. Descobrir qual é o caso custa um `grep`.
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

O retorno de cada execução vai para a **issue #45** ("Calibragem da auditoria automática"), que é permanente e não deve ser fechada. Ao encerrar, comente lá o balanço do dia no formato curto de `.claude/routines/auditoria.md` (PASSO 5): uma linha de cabeçalho, um candidato por linha com a chave da tabela e o **contador acumulado** de ocorrências, sem seções vazias. O formato anterior chegou a 5 KB por comentário e recitava a lista de issues da área em 45 de 52 balanços.

Comentar é obrigatório quando houve sinal — issues abertas, candidatos descartados, ou um critério que se mostrou vago. Dia sem nenhum dos três não precisa de comentário.

Isso não é burocracia: **o que a auditoria decide NÃO reportar é o dado mais valioso que ela produz**, e é o único que não deixa rastro em lugar nenhum. Issue aberta fica no GitHub; achado descartado some com a sessão.

A divisão é:

- **Issue #45 é a caixa de entrada.** Um comentário por execução, barato, sem PR. É onde o sinal bruto se acumula.
- **Este arquivo é o livro-razão.** Só recebe mudança de critério já ratificada, via PR, quando um padrão se repetiu o bastante para virar regra.
- **A Routine `calibragem` (mensal, dia 1) faz a ratificação** — prompt em `.claude/routines/calibragem.md`. Entre 2026-08-25 e 2026-11-24 a #45 recebeu 52 balanços e nada subiu, porque ratificar dependia de alguém lembrar.

A contagem de repetições é **acumulada**: cada execução lê os balanços da #45 desde a última entrada do Histórico abaixo antes de registrar o seu (PASSO 2 do prompt). Sem isso, a 5ª ocorrência é registrada como "primeira" — foi o que aconteceu com `toAmount`, com o ponteiro da segunda e com o clone raso.

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

- **2026-11-24** — Revisão dos 52 balanços da #45 de 2026-08-26 a 2026-11-24 (~200 KB), junto com a migração das Routines para a v2. Nenhum critério tinha subido desde 08-25, e a subcontagem que aquela revisão diagnosticou voltou inteira. Mudanças:

  **Fatos desmentidos, corrigidos.** "A sessão não tem `node_modules`" (falso desde 09-01; oito execuções rodaram `npm ci`; uma, em 10-02, desistiu de executar por causa do texto). Caminho `chromium-1194` (hoje `-1243`; o texto deixou de fixar versão). Ponteiro de segunda dizendo que `getAnnualOverview`/`getCreditAccounts` não têm teste (têm; seguido 6× sem render). "47 pacotes diretos" (contagem frágil, saiu). Âncora `historico-params.test.ts:34` (apodreceu depois da #110).

  **Clone raso entrou na exigência 2 e na Ferramental.** O clone tem ~325 commits; os 6 hashes citados neste arquivo não existem nele, e `git log -S` devolve commit de fronteira em vez de erro. 3 ocorrências (08-27, 09-04, 09-29), a última quase virando issue falsa.

  **"Request forjado" virou regra explícita, e mais estreita.** Morreu por ela em 12 execuções; o PR #217 (mergeado em 11-22) corrigiu três desses candidatos — custo pago em código mergeado, sobe com uma ocorrência. A regra separa payload forjado contra os próprios dados (não reportar) de estado alcançável pela UI sem forjar (aba velha, dialog obsoleto, duplo clique — reportável, categoria 3).

  **Categoria 2, `toAmount`**: reescrita para o caso que de fato quebra (nullable sem `?? 0`, ou ciphertext). 5 mortes, todas registradas como "primeira".

  **Categoria 4, dialog no `catch`**: qualificada para formulário; confirmação de exclusão com toast é a forma da #35 (3 mortes). O `CLAUDE.md` recebeu a mesma exceção.

  **"O que NÃO reportar"**: Dependabot só dispensa com CI verde e mergeável (09-22, 10-20); "decisão de produto" só dispensa quando a decisão não está nem delimitada — delimitada vira `[pergunta]` (10-23 → #215 em 10-30).

  **Tabela de falsificados**: +24 linhas (~90 re-derivações); a do `installmentAmount` saiu (é a #195).

  **Rotação**: segunda com pontos de partida que renderam; terça com Dependabot vermelho e re-alvejamento como comentário; quinta reescrita para categoria 4 e contratos de Server Action (rendeu 0 no foco de 10-01 a 10-29 varrendo superfície de URL já fechada por 7 issues); sexta lendo `docs/<domínio>/` inteiro (a evidência veio de 5 docs diferentes, nenhum o `05-roadmap.md`) e o Client Component da page.

  **Vazão por área virou regra mecânica** (backlog parado ≥ 5 → revalidar e usar o slot livre). A nota anterior teve ~11 "considerar ceder" e nenhuma cessão.

  **Ferramental reescrita** com as técnicas que se repetiram (réplica de função pura, harness `esbuild` + Chromium, CDP de foco e download, `npm pack` + `diff -rq`, `npm audit --package-lock-only`, medir a correção errada) e o que o proxy bloqueia. Entrou a fonte de achado "escopo declarado de correção anterior" (6×).

  **Acompanhando, sem subir** (1–2 ocorrências ou dependem de decisão): limiar de "duplicação sem divergência" (o #217 também removeu duplicatas que a rotina absolveu — `1f5e8ce`, `455a85a`/`f0312c6` — mas como limpeza, não como bug); terceiro modo de "coberto mas não protegido" — invariante declarado sobre o subconjunto que não o viola (09-11); exigência 8 aplicada ao predicado de gate proposto (09-17, #150); eixo da checagem de convenção (10-01).
