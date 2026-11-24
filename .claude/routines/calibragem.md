# Routine `calibragem` — prompt (mensal)

Você ratifica a calibragem da auditoria: transforma o sinal acumulado na issue #45 em mudança versionada do `.claude/audit.md`. Sua saída é: **um** PR (não draft) que edita `.claude/audit.md` — e, se necessário, os prompts em `.claude/routines/` — mais um comentário na #45 apontando o PR.

Por que existe: entre 2026-08-25 e 2026-11-24 a #45 recebeu 52 balanços e nenhum critério foi incorporado. A revisão de 08-25 já tinha diagnosticado subcontagem; ela voltou inteira, porque ratificar dependia de alguém lembrar.

## PASSO 0 — Carregar

1. Leia `.claude/audit.md` inteiro (Read, sem `limit`) e `.claude/routines/auditoria.md`.
2. Clone raso: `git rev-parse --is-shallow-repository`; se `true`, `git fetch --unshallow origin`.
3. Ache a data da última entrada de "Histórico de calibragem" e leia **todos** os comentários da #45 desde então:

   ```bash
   gh api "repos/Guiroos/mare/issues/45/comments?since=<data>T00:00:00Z&per_page=100" --paginate --jq '.[] | .created_at + "\n" + .body'
   ```

4. Liste os PRs mergeados no período (`pulls?state=closed&sort=updated&direction=desc`, filtre `merged_at`) e leia títulos e mensagens de commit.

GitHub: GraphQL dá 403 no sandbox; use `gh api` (REST).

Nenhum comentário novo na #45 desde a última ratificação: encerre sem PR.

## PASSO 1 — Contar

Monte três listas, cada item com as datas em que apareceu:

1. **Critérios vagos/errados** apontados nos balanços.
2. **Candidatos descartados** (com a checagem que matou).
3. **Fatos do `audit.md` desmentidos** — caminho que não existe, contagem velha, ponteiro que não rende, comando que não funciona. Confira cada fato citado no arquivo contra o repo de hoje (`ls`, `grep`, `git cat-file -e <hash>`), mesmo sem balanço apontando.

## PASSO 2 — Decidir o que sobe

Regras de `audit.md` § Calibragem, aplicadas sem subcontagem:

- **Descartado 3 vezes ou mais** → linha na tabela "Candidatos já falsificados" (com "Volta a valer se"), ou critério reescrito se a causa for o critério.
- **Custo já pago em código mergeado** → sobe com **uma** ocorrência. Em particular: candidato que a auditoria matou e um PR do período corrigiu mesmo assim é evidência de que o limiar está mais restrito que o critério do mantenedor (2026-11-22: o PR #217 corrigiu três candidatos mortos pela regra de "request forjado").
- **Fato desmentido** → corrige direto.
- Linha da tabela de falsificados cujo candidato virou issue, ou cujo código sumiu → sai da tabela, com uma frase no Histórico.

Não promova o que tem 1–2 ocorrências sem custo pago: registre no corpo do PR como "acompanhando" com a contagem, para a próxima calibragem não recomeçar do zero.

## PASSO 3 — Editar e abrir o PR

- Branch: `claude/calibragem-<AAAA-MM>`.
- Edite `.claude/audit.md`: critérios, tabela, Ferramental, rotação — e uma entrada nova em "Histórico de calibragem" com a data de hoje, dizendo o que mudou e por quê (com as datas dos balanços que sustentam cada mudança).
- Se a mudança for de PROCESSO (o que a auditoria faz, não o que ela julga), edite `.claude/routines/auditoria.md` no mesmo PR.
- `npm run format:check` verde.
- PR com título `docs(audit): calibragem <AAAA-MM>` e corpo listando: o que subiu (com contagem e datas), o que saiu da tabela, o que fica "acompanhando". Termine o corpo com `refs #45` — a #45 nunca fecha.
- Comente na #45: `Calibragem <AAAA-MM>: PR #<n> — ratifica até <data do último balanço lido>.`

## REGRAS

- Não edite código de aplicação. Só `.claude/audit.md` e `.claude/routines/*.md`.
- Não invente critério que nenhum balanço sustenta; não apague critério sem evidência de que deixou de valer.
- Nunca faça merge.

## AO ENCERRAR

PR aberto, quantos balanços leu (intervalo de datas), o que subiu, o que saiu, o que ficou acompanhando.
