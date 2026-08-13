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
- `revalidatePath` faltando num caminho que a mudança afeta — em especial `/panorama`, que toda action de dado financeiro precisa revalidar junto com `/dashboard`
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
- `overrides`/`resolutions` no `package.json` sem comentário explicando por que existem

Aponte a versão-alvo e o que quebra ao subir. Não abra issue que apenas replica o alerta do Dependabot.

### Quarta — Acessibilidade
Semântica, ordem de foco, navegação por teclado, contraste, ARIA incorreta. Atenção a dialogs e drawers (foco preso e devolvido ao fechar), `RowActions` e menus kebab, e ao modo escuro — o contraste precisa passar nos dois temas.

### Quinta — Tipagem e contratos
Tipos que são verdade sintática e mentira semântica: a assinatura diz `string` mas o valor é ciphertext, id não validado, ou mensagem que não sobrevive à fronteira de Server Action. Categorias 3 e 4 acima. Prefira a correção que faz o compilador impedir a recaída.

### Sexta — Arquitetura e acoplamento
Categoria 5 acima. Dependência circular, camada vazando (page fazendo trabalho de `lib/queries/`), duplicação estrutural.

---

## Exigências de todo achado

Valem em qualquer dia, independentemente do foco.

1. **Evidência no código, não em tese.** Caminho e linha, trecho real, e por que é problema *aqui*.
2. **Tentativa de falsificação registrada.** Antes de abrir, tente derrubar o próprio achado: leia o schema, rode `git log -S` no trecho para ver se foi decisão deliberada, levante a convenção do repo. Se a hipótese sobreviver, registre o que foi verificado. Se morrer, não abra.
3. **Nota de cobertura.** Diga se existe teste que pegaria isso — e, se não existe, qual caso específico cobriria. Isso substitui "faltam testes" como issue própria. O caso proposto precisa incluir a entrada que **só a correção certa rejeita**: se o teste também passaria com a implementação errada mais provável, ele não cobre nada — a suíte fica verde sobre o furo e a revisão perde o único sinal automático que tinha.
4. **Impacto para quem, em que cenário.** Se não der para descrever um usuário afetado, o achado provavelmente não passa do teto de relevância.
5. **Custo estimado**: P (1 arquivo) / M (2-4) / G (estrutural).
6. **Helper nomeado, motivo declarado.** Quando a proposta depende de um helper ou schema específico, dizer *por que aquele* e não o similar mais óbvio do repo. Sem isso, quem implementa reusa o helper conhecido — que é o caminho natural e pode ser exatamente o errado.
7. **Superfície citada tem consumidor.** Antes de afirmar que algo "some da tela X", "não aparece no gráfico Y" ou "quebra o componente Z", `grep` pelo componente e confirme que ele é importado em algum lugar. Impacto declarado sobre tela que não é renderizada é ficção, e custa caro: quem implementa escreve teste para o caminho morto. Se a superfície não tem consumidor, ou o achado muda de impacto, ou o achado vira outro (o código morto em si).
8. **Achado multi-site diz quantos são — e fecha por inteiro.** Quando o achado se repete em N lugares, enumere os N no corpo, explicitamente. O PR que fecha ou cobre os N, ou lista na descrição quais ficaram de fora e por quê. `closes #N` num PR que cobre parte da lista é erro de contrato: use `refs #N` e deixe a issue aberta. Vale para quem audita (enumerar) e para quem revisa (conferir a lista antes de aprovar o `closes`).

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
