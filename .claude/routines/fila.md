# Fila de implementação automática — contrato de labels

Lido pelas Routines `implementacao` e `review` (prompts em `.claude/routines/`). **Não** é importado pelo `CLAUDE.md`: sessão de desenvolvimento local não precisa carregar isto.

**Precedência:** este arquivo é a autoridade sobre o ESTADO DA FILA (labels, higiene, quem pega o quê). Os prompts em `.claude/routines/*.md` são a autoridade sobre o PROCESSO. Desde a v2 (2026-11-24) os dois são versionados e precisam concordar — divergência entre eles é bug de doc, corrigido no mesmo PR que a encontrar. A seção "Correções que este arquivo impõe sobre o prompt", que existia porque o prompt v1 morava na UI e não era editável por agente, saiu: as correções foram incorporadas aos prompts.

---

## Estados

Toda execução precisa deixar a issue em UM destes estados. Encerrar sem deixar a issue em um deles é deixar lixo na fila.

| Estado | Labels | Significado |
| --- | --- | --- |
| Na fila | `claude-ready` | elegível, ninguém pegou |
| Reservada | `claude-ready` + `claude-wip` | execução em andamento agora |
| Com PR | `claude-wip` (sem `claude-ready`) | PR aberto, saiu da fila, aguarda review/humano |
| Fora do ciclo | nenhuma das duas | precisa de decisão humana antes de voltar |

`claude-wip` sozinha **nunca** significa "abandonada" — significa "tem PR aberto". Se estiver assim sem PR aberto, a higiene devolve para a fila.

Labels auxiliares: `claude-bloqueada` (fora do ciclo por falha repetida) e `claude-precisa-fatiar` (legado — ver abaixo). Se não existirem, criar via REST antes de aplicar.

**Sem teto de arquivos desde a v2.** O teto de 5 arquivos da v1 foi aplicado de forma inconsistente (no mesmo 2026-11-24 a #98 foi recusada com 8 arquivos e o #220 saiu com 8) e gastou execuções inteiras redescobrindo o que a issue já declarava (#117 dizia "5 código + 1 teste"; #98 dizia "encosta em G"). Quem aprova a issue com `claude-ready` decidiu que ela cabe num PR. As issues que ficaram com `claude-precisa-fatiar` (#98, #150, #152, #170, #176 em 2026-11-24) continuam fora do ciclo até um humano devolver `claude-ready` — a label não é mais aplicada por execução nenhuma. O que segura escopo agora é a regra de escopo da implementação ("resolva a issue e SÓ ela") e a do review ("não proponha fora do escopo da issue").

## Transição por caminho de saída

| Caminho de saída | Estado final | Labels a mexer |
| --- | --- | --- |
| Reservou a tarefa | Reservada | `+claude-wip` |
| Já existe PR aberto para a issue | Com PR | `-claude-ready` (garantir `claude-wip`) |
| Problema não existe mais / issue descreve mal | Fora do ciclo | `-claude-ready` `-claude-wip` |
| Gates vermelhos, 1ª falha | Na fila | `-claude-wip` |
| Gates vermelhos, 2ª falha | Fora do ciclo | `-claude-ready` `-claude-wip` `+claude-bloqueada` |
| PR aberto | Com PR | `-claude-ready` |
| PR mergeado | (issue fecha ou segue com `refs`) | `-claude-wip` se a issue continuar aberta com escopo restante — volta para "Fora do ciclo" até humano reaprovar o resto |

Comentário de PR aberto tem **exatamente** este formato na primeira linha, porque a higiene depende dele:

```
PR aberta: #<n>
```

## Higiene de fila (início de toda execução de implementação)

Roda antes de pegar trabalho novo:

```bash
gh api "repos/Guiroos/mare/issues?labels=claude-wip&state=open&per_page=100" \
  --jq '.[] | select(.pull_request | not) | {number, title, updated_at}'
```

Para cada issue, achar o PR **por menção à issue, não por nome de branch** — 17 PRs da v1 saíram em `claude/quirky-johnson-*`, e a higiene que procurava `claude/issue-<n>-*` não os enxergou, o que deixou passar as duplicatas de 2026-10-02 (#181 duplicando #165):

```bash
gh api "repos/Guiroos/mare/issues/<numero>/comments" --jq '.[].body' | grep -E '^PR aberta: #'
gh api -X GET search/issues -f q='repo:Guiroos/mare is:pr "#<numero>"' --jq '.items[] | {number, state, title}'
gh api "repos/Guiroos/mare/pulls/<n>" --jq '{state, merged}'
```

- **PR aberto** → em andamento de verdade. Não tocar.
- **PR mergeado, issue ainda aberta** (PR era `refs`, sobrou escopo) → comentar `PR #<n> mergeado com escopo restante — fora do ciclo até reaprovação`, remover `claude-wip`. Não devolver `claude-ready`: o resto precisa de humano olhando a seção **Onde** atualizada.
- **PR fechado sem merge** (e nenhum outro aberto) → comentar `PR #<n> fechado sem merge — issue devolvida à fila`, remover `claude-wip`, garantir `claude-ready`.
- **Nenhum PR, issue parada há mais de 24h** → execução anterior morreu antes de abrir PR. Comentar `Reserva sem PR — issue devolvida à fila (morte silenciosa <k>/2)`, remover `claude-wip`, garantir `claude-ready`.
- **Nenhum PR, menos de 24h** → pode ser execução acontecendo agora. Não tocar.

**Limite de morte silenciosa: 2.** Se a issue já tem dois comentários `morte silenciosa`, a terceira não devolve à fila: aplicar `claude-bloqueada`, remover `claude-ready` e `claude-wip`, e comentar o que se sabe. A #91 precisou de 4 reservas mortas (21, 23 e 25/09) até o #173 sair; duas mortes no mesmo ponto já não são acaso.

Os comandos são REST de propósito: no sandbox das Routines o GraphQL do GitHub responde 403, e `gh issue list/view/edit` e `gh pr list/view/create` dependem dele. O endpoint `/issues` também devolve PRs — daí o `select(.pull_request | not)`.

## Ciclo de review sem webhook

Na v1 a sessão de implementação se inscrevia no PR (`subscribe_pr_activity`, via conector `Claude_Code_Remote`) e corrigia 2–5 min depois do review. A v2 não tem o conector — não dá para configurá-lo nem na v1 nem na v2 — então o ciclo passa a ser por **status de commit**, que é mecânico e sobrevive a sessão morta:

1. A Routine `review` grava em todo head que olha um status `claude-review` com `description` em um destes formatos exatos:
   - `sem achados`
   - `achados: <N> (<B> bloqueantes)`
   - `só merge de main`
   - `pulado: <motivo>`
2. A Routine `implementacao`, no início de cada execução, procura PRs abertos cujo **head** tem `claude-review` = `achados: …`. Para esses, o head foi revisado com achados e ninguém respondeu ainda: ela corrige, empurra commit novo, e o head novo fica sem status — o review seguinte o pega.
3. **Rodada** = um status `achados: …` num commit do PR. Implementação corrige no máximo 2 rodadas; na 3ª, comenta no PR `Precisa de humano: 3ª rodada de review com achados` e não toca mais. Review, a partir da 3ª rodada, só levanta bloqueante de comportamento (ver `review.md`).

**"Já revisado" é só o status.** A v1 também contava "review seu com o mesmo `commit_id`" — e a implementação responde às threads com a mesma identidade, criando um review-wrapper com `commit_id` = head corrigido. Todo commit de correção parecia revisado e não era (#120 e #123 esperaram 2 dias; o bot reclamou disso em #169, #171, #173). 9 PRs mergearam sem review, e 3 deles (#174, #182, #193) precisaram de correção humana antes do merge.

## Cadência

| Horário (BRT) | Routine | Cron (`CRON_TZ=America/Sao_Paulo`) |
| --- | --- | --- |
| 06:57 | `implementacao-diaria-v2` | `57 6,9,12 * * 1-5` |
| 07:58 | `auditoria-diaria-v2` | `58 7 * * 1-5` |
| 08:56 | `review-de-pr-v2` | `56 8,11,14 * * 1-5` |
| 09:57 | `implementacao-diaria-v2` | ⤴ |
| 11:56 | `review-de-pr-v2` | ⤴ |
| 12:57 | `implementacao-diaria-v2` | ⤴ |
| 14:56 | `review-de-pr-v2` | ⤴ |
| dia 1, 16:23 | `calibragem-mensal` | `23 16 1 * *` |

Pares `implementação → review` com ~2h entre eles; a implementação seguinte responde ao review anterior (ver "Ciclo de review sem webhook"). A tabela é a intenção; se divergir da UI de Routines, a UI é o que roda — corrigir um dos dois.

Duas execuções no mesmo dia tornam a reserva crítica: é `claude-wip` que impede a segunda de pegar a issue que a primeira está implementando. Execução que não consegue aplicar a label **para**.

## Vazão

A vazão é limitada pela aprovação e pelo merge humanos, não pela Routine. Medido na v1 (2026-07-31 a 2026-11-24): 56 PRs, 53 mergeados, mediana de 38,6h até o merge mas bimodal — em agosto saía no mesmo dia, de setembro em diante 10–45 dias, mergeados em lote. A fila ficou vazia de 12/10 a 24/11 e recebeu 18 `claude-ready` de uma vez. PR parado acumulou ~60 commits de "merge main": por isso a implementação só atualiza branch com `main` quando há **conflito** (`mergeable_state = dirty`), nunca só por estar atrás.

## Ao encerrar

Reportar em que estado da tabela cada issue tocada ficou, pelo nome. Se a higiene recuperou alguma issue presa, dizer qual e por quê — issue presa é sintoma de execução que morreu no meio, e a frequência importa mais que o caso isolado.
