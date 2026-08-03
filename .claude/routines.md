# Fila de implementação automática — contrato de labels

Referenciado por `CLAUDE.md` via `@`. Define o ciclo de vida das labels que a Routine `implementacao-diaria` usa para escolher trabalho.

**Precedência:** este arquivo é a autoridade sobre o ESTADO DA FILA. O prompt da Routine é a autoridade sobre o PROCESSO de implementar (escopo, gates, formato do PR). Onde os dois divergirem sobre qual label aplicar ou remover, **este arquivo vence** — mesmo padrão já usado entre o prompt da `auditoria-diaria` e `.claude/audit.md`.

O prompt da Routine é criado pela UI de Routines e não é editável por agentes (`update_trigger` recusa: *"this routine was created via http_api"*). Por isso o contrato mora aqui: é o único lugar que dá para versionar e revisar.

---

## Estados

Toda execução precisa deixar a issue em UM destes estados. Não existe caminho de saída sem estado definido — encerrar sem deixar a issue em um deles é deixar lixo na fila.

| Estado | Labels | Significado |
| --- | --- | --- |
| Na fila | `claude-ready` | elegível, ninguém pegou |
| Reservada | `claude-ready` + `claude-wip` | execução em andamento agora |
| Com PR | `claude-wip` (sem `claude-ready`) | PR aberto, saiu da fila, aguarda humano |
| Fora do ciclo | nenhuma das duas | precisa de decisão humana antes de voltar |

`claude-wip` sozinha **nunca** significa "abandonada" — significa "tem PR aberto". Se estiver assim sem PR aberto, a higiene de fila devolve para a fila.

Labels auxiliares: `claude-precisa-fatiar`, `claude-bloqueada`. Se não existirem, criar com `gh label create <nome>` antes de aplicar.

## Transição por caminho de saída

| Caminho de saída | Estado final | Labels a mexer |
| --- | --- | --- |
| Reservou a tarefa (PASSO 2) | Reservada | `+claude-wip` |
| Problema não existe mais (PASSO 3) | Fora do ciclo | `-claude-ready` `-claude-wip` |
| Escopo > 5 arquivos (PASSO 4) | Fora do ciclo | `-claude-ready` `-claude-wip` `+claude-precisa-fatiar` |
| Gates vermelhos, 1ª falha (PASSO 5) | Na fila | `-claude-wip` |
| Gates vermelhos, 2ª falha (PASSO 5) | Fora do ciclo | `-claude-ready` `-claude-wip` `+claude-bloqueada` |
| PR aberto (PASSO 6) | Com PR | `-claude-ready` |

### Correções que este arquivo impõe sobre o prompt

Três caminhos do prompt estão errados hoje. Onde o texto abaixo divergir do prompt, seguir este arquivo.

**PASSO 4 (escopo > 5 arquivos).** O prompt diz *"comente na issue propondo como fatiar em partes menores, remova `claude-wip` e encerre sem PR"* — mantendo `claude-ready`. Isso devolve a issue para a fila com o escopo idêntico: a próxima execução chega na mesma conclusão, comenta de novo e sai, todo dia útil. E como o PASSO 1 pega sempre a MAIS ANTIGA, uma issue grande demais fica presa na cabeça da fila e **bloqueia tudo que está atrás** indefinidamente. Remover `claude-ready` junto é obrigatório: só um humano refatiando o escopo tira ela desse estado.

**PASSO 5 (gates vermelhos).** O prompt diz *"comente na issue o que travou, remova `claude-wip` e encerre"*, sem limite de tentativas. Retry é legítimo para falha transitória (rede, flake, serviço fora), mas não indefinidamente. Antes de encerrar, checar se já existe comentário de falha anterior nesta issue (`gh issue view <n> --json comments`): primeira falha volta para a fila; a partir da segunda, `claude-bloqueada` e fora do ciclo. Duas falhas no mesmo ponto não é flake, é bloqueio real.

**PASSO 6 (sucesso).** O prompt não manda mexer em label nenhuma no caminho de sucesso — só *"comente o link do PR na issue"*. Sem remover `claude-ready`, a issue continua elegível e uma execução futura pode implementar a mesma coisa duas vezes. `claude-wip` fica, porque é ela que marca "tem PR aberto".

O comentário do link deve ter **exatamente** este formato na primeira linha, porque a higiene de fila depende dele:

```
PR aberta: #<n>
```

## Higiene de fila (antes de pegar trabalho novo)

Roda no início de cada execução, antes do PASSO 1, para recuperar o que ficou preso:

```bash
gh issue list --label claude-wip --state open --json number,title,updatedAt
```

Para cada issue, achar o PR pelo comentário `PR aberta: #<n>` e conferir o estado dele:

```bash
gh issue view <numero> --json comments
gh pr view <n> --json state,merged
```

- **PR aberto** → em andamento de verdade. Não tocar.
- **PR fechado sem merge** → trabalho abandonado. Comentar `PR #<n> fechado sem merge — issue devolvida à fila`, remover `claude-wip`, garantir `claude-ready`.
- **Nenhum PR, issue parada há mais de 24h** → execução anterior morreu antes de abrir o PR. Comentar o que houve, remover `claude-wip`, garantir `claude-ready`.
- **Nenhum PR, menos de 24h** → pode ser execução acontecendo agora. Não tocar.

Issue fechada não aparece nessa lista (`--state open`): o merge já resolveu e a label ficar no histórico não atrapalha ninguém — issues #32 a #35 estão assim e não precisam de limpeza.

## Ao encerrar

Reportar em que estado da tabela a issue ficou, pelo nome. Se a higiene recuperou alguma issue presa, dizer qual e por quê — issue presa é sintoma de execução que morreu no meio, e a frequência disso importa mais que o caso isolado.
