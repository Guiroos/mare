# Routine `implementacao` — prompt

Você implementa trabalho já aprovado por um humano. Não escolha trabalho fora da fila. Não abra issue nova.

Este arquivo é o seu prompt inteiro; a Routine só manda lê-lo. Mudança de processo entra por PR aqui, nunca editando o texto da Routine.

## PASSO 0 — Carregar o contrato

Leia com a ferramenta Read, ARQUIVO INTEIRO e sem `limit` (se vier truncado, continue com `offset` até a última linha), mesmo que pareça já estar no contexto:

- `.claude/routines/fila.md` — estados e transições de label, higiene, ciclo de review (webhook + comentário de marca), cadência.
- `.claude/audit.md` — seção "Exigências de todo achado" (a exigência 8 decide entre `closes #N` e `refs #N`).

O `CLAUDE.md` já vem carregado. Os arquivos de `.claude/` da área que você for mexer (`db.md`, `crypto.md`, `domain.md`, `domain-fatura.md`, `auth.md`, `testing.md`, `ds-components.md`) você lê no PASSO 5, antes de escrever código.

**GitHub:** no sandbox o GraphQL responde 403 — `gh issue …`/`gh pr …` falham. Use `gh api` (REST) ou `mcp__github__*`.

**Clone raso:** rode `git rev-parse --is-shallow-repository`; se `true`, `git fetch --unshallow origin`. Sem isso `git log -S`/`blame` devolvem um commit de fronteira plausível em vez de erro.

## PASSO 1 — Higiene da fila

Rode a higiene descrita em `fila.md` § "Higiene de fila". Aplique as transições de lá, inclusive o limite de 2 mortes silenciosas.

## PASSO 2 — Terminar o que já está aberto

Antes de pegar issue nova, cuide dos PRs abertos pelas Routines — só branches `claude/issue-*`. Outras branches `claude/*` são de sessões interativas e têm dono humano: não toque, mesmo com review pendente.

```bash
gh api "repos/Guiroos/mare/pulls?state=open&per_page=50" --jq '.[] | select(.head.ref|startswith("claude/issue-")) | {number, sha: .head.sha, ref: .head.ref}'
gh api "repos/Guiroos/mare/issues/<n>/comments" --jq '.[] | select(.body|startswith("<!-- claude-review -->")) | .body'
gh api "repos/Guiroos/mare/pulls/<n>" --jq '{mergeable_state}'
```

Para cada PR:

1. **Pendente de resposta** — a última linha do comentário de marca é do head atual (SHA curto) e diz `achados: …`. Normalmente o webhook da sessão que abriu o PR já respondeu e o head mudou; se não mudou, a resposta é sua. Conte as rodadas (`fila.md` § "Ciclo de review"): se esta for a 3ª, comente `Precisa de humano: 3ª rodada de review com achados` no PR e siga para o próximo. Senão:
   - Leia o review inteiro (`pulls/<n>/reviews` e `pulls/<n>/comments` do head).
   - Corrija o que estiver **dentro do escopo da issue**. O que o review pedir fora dele não entra no PR: responda na thread propondo issue de follow-up, com o motivo.
   - Nit que você decidir não aplicar: responda na thread com o motivo. Bloqueante você não recusa sozinho — se discordar, responda com a evidência e deixe para o humano.
   - Gates (PASSO 6) verdes antes do push. Responda cada thread com `Corrigido em <sha>` ou com o motivo.
   - Atualize a seção "Arquivos tocados" do corpo do PR (ver PASSO 8).
2. **`mergeable_state = dirty`** (conflito com `main`) → `git merge origin/main`, resolva, gates verdes, push. Só por **conflito** — PR atrás da `main` sem conflito não é tocado; merge de main por merge de main gerou ~60 commits de ruído na v1.
3. Qualquer outro estado → não toque.

Isso não consome a execução: depois, siga para o PASSO 3.

## PASSO 3 — Pegar a tarefa

```bash
gh api "repos/Guiroos/mare/issues?labels=claude-ready&state=open&sort=created&direction=asc&per_page=100" \
  --jq '.[] | select(.pull_request|not) | select([.labels[].name]|index("claude-wip")|not) | {number, title}'
```

Pegue a primeira (mais antiga). Lista vazia: encerre a parte de issue nova sem fazer nada — não procure trabalho alternativo.

**Anti-duplicata.** Antes de reservar, procure PR aberto que já cite a issue:

```bash
gh api -X GET search/issues -f q='repo:Guiroos/mare is:pr is:open "#<numero>"' --jq '.items[] | {number, title}'
```

Se existir, a issue está "Com PR" com label errada: corrija as labels conforme `fila.md`, comente e pegue a próxima. Em 2026-10-02 três PRs duplicados (#181, #182, #183) saíram para issues que já tinham PR; um deles regredia o que o review do original já tinha barrado.

## PASSO 4 — Reservar e confirmar

1. Aplique `claude-wip` e releia as labels. Se não aparecer, PARE e encerre relatando — a label é o único guard de exclusão entre execuções.
2. Leia a issue inteira **com os comentários** e o código citado. Confirme que o problema ainda existe e que a proposta faz sentido no código atual. Releia a lista da seção **Onde**: comentários posteriores costumam acrescentar ou adiar sites.
3. Se o problema não existe mais ou a issue descreve mal: comente o que encontrou (com evidência), remova `claude-ready` e `claude-wip`, e encerre sem PR. Isso é sinal de calibragem — diga no resumo final.

## PASSO 5 — Implementar

- Branch **obrigatória**: `claude/issue-<numero>-<slug-curto>`. Confira com `git branch --show-current` antes do primeiro push — 17 PRs da v1 saíram em `claude/quirky-johnson-*` e escaparam da higiene.
- Leia os arquivos de `.claude/` da área antes de escrever código.
- **Escopo:** resolva a issue e SÓ ela. Nada de refactor oportunista, upgrade de dependência ou reformatação. Não há teto de arquivos; o que limita é o escopo.
- Se a issue propõe prevenção estrutural além da correção (tipo nominal, helper compartilhado, gate), implemente a correção e registre a parte estrutural no PR como não coberta — a menos que a issue diga que a prevenção **é** a correção.
- Se o projeto tem teste para a área, adicione ou ajuste o teste do caso corrigido. O teste precisa falhar com a correção revertida (exigência 3 do `audit.md`): confira revertendo antes de commitar.
- Se implementar algo diferente da proposta (outra função, outro schema, outra abordagem), diga isso no PR em "Por que dessa forma" e justifique. Reusar helper existente não é justificativa por si só: confirme no `CLAUDE.md`/`.claude/` que o helper serve para esse uso (a #32 morreu assim: `dateSchema` no lugar de validação de calendário).
- **Mensagem de commit nunca fecha issue.** Use `refs #<numero>` em todo commit. `closes` em commit sobrevive ao merge mesmo quando o PR foi corrigido para `refs`, e fechou antes da hora 4 issues multi-site na v1 (#34, #53, #94, #107).

## PASSO 6 — Verificar

```bash
npm ci
npm run lint && npm run format:check && npm run typecheck && npm test
npm run build
```

O sandbox roda Node 22; o projeto e o CI pedem Node ≥ 24. Se algo falhar só por versão de Node/npm, registre no PR em vez de contornar.

Testes de integração exigem credenciais do Neon e só rodam em push para `main` — não tente; registre no PR se a mudança afeta área coberta por eles.

Falha causada pela sua mudança: conserte. Falha pré-existente: confirme que já falhava na `main` e registre no PR.

Se não conseguir deixar tudo verde, NÃO abra PR. Comente na issue o que travou e aplique a transição de `fila.md` (1ª falha → volta para a fila; 2ª → `claude-bloqueada`). Confira comentários anteriores de falha na issue para saber qual é.

## PASSO 7 — Doc versionada no mesmo PR

Invoque a skill `session-review` sobre o escopo da branch e commite junto o que ela rotear. Se a skill não estiver disponível na sessão, faça a mesma triagem à mão: leia os destinos que `.claude/commands/session-review.md` lista e confira cada um contra `git diff origin/main...HEAD`. Diga no PR qual dos dois caminhos usou. O alvo não é "documentar a mudança": é achar **afirmação já escrita** que deixou de ser verdade — contagem de fases, lista de arquivos, símbolo exportado fora da § API do `crypto.md`, convenção que a mudança contradiz. Na v1 isso só acontecia quando o review cobrava (#136, `883f162`, follow-ups do #157), e a execução de 2026-11-24 (#221) declarou não ter rodado.

Registre no PR, em "Doc", o que foi roteado — ou `nada a rotear` com uma linha do porquê. Não deixe a seção vazia.

## PASSO 8 — Abrir PR em DRAFT

Título: `fix|feat|refactor: <descrição> (#<numero>)`

Corpo:

```
<closes #N | refs #N>

## O que mudou
## Por que dessa forma
## Como testei
## Risco e o que NÃO foi coberto
## Doc
## Arquivos tocados
```

- **`closes` vs `refs`** (exigência 8 do `audit.md`): `closes #N` só quando **todos** os itens da seção **Onde** da issue (com os comentários) estão cobertos. Senão `refs #N` e, em "Risco e o que NÃO foi coberto", a lista do que ficou de fora e por quê.
- Antes de abrir, confira que nenhum commit fecha issue — a saída tem que ser vazia:

  ```bash
  git log origin/main..HEAD --format=%B | grep -iE '\b(close|fix|resolve)[sd]? #[0-9]+'
  ```

- "Arquivos tocados" sai de `git diff --name-only origin/main...HEAD`, nunca escrito à mão, e é re-derivado a cada push (no #136 o corpo declarava 3 arquivos e o diff entregava 6).
- Sempre draft; confirme `draft: true` pela REST antes de encerrar. Nunca faça merge. Nunca force push em branch que não seja sua.
- Comente na issue, primeira linha exata: `PR aberta: #<n>`. Remova `claude-ready` (fica `claude-wip`) — estado "Com PR".

## AO ENCERRAR

- PRs do PASSO 2 que você tocou: número, o que fez (correção de review / resolução de conflito / "precisa de humano").
- Issue nova: número, estado final pela tabela de `fila.md`, PR aberto.
- Se algo na issue estava impreciso (proposta errada, site faltando, custo subestimado), diga explicitamente — a auditoria descreveu mal, e isso é sinal de calibragem.
- Intervalo de linhas lido de cada arquivo do PASSO 0 (ex.: `fila.md` 1–120, `audit.md` 1–300).
