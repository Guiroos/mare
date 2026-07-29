# Exportação de extrato em XLSX

**Data:** 2026-07-28
**Status:** aprovado, aguardando implementação

## Problema

Não há como tirar os dados do Maré. O usuário quer conferir os números do app contra outras
ferramentas de finanças, e para isso precisa de um arquivo com uma linha por lançamento, aberto
no Excel, com valores e datas em células tipadas — não texto.

O `/panorama` já tem um botão "Exportar" renderizado com `disabled` (`app/(app)/panorama/page.tsx:86`),
um placeholder que nunca foi ligado. Este spec o implementa e estende o padrão a outras telas.

## Escopo

Cinco botões, cinco telas, duas rotas de API.

| Tela | Recorte exportado |
| --- | --- |
| `/historico` | os filtros ativos na tela (período, tipos, categorias, contas, busca) |
| `/dashboard` | o mês de referência — ou o ciclo de fatura, quando `?cycleAccount=` está ativo |
| `/panorama` | o ano selecionado (`01-01` a `12-31`) |
| `/devedores` | duas abas: saldos por pessoa + todos os lançamentos |
| `/devedores/[id]` | os lançamentos daquela pessoa |

**Fora de escopo:** abas de resumo agregado (totais por categoria/mês). A decisão foi exportar
apenas o extrato bruto — o usuário monta as próprias tabelas dinâmicas. Também fora: exportação
em `/parcelas`, `/investimentos` e `/metas`.

## Decisões de arquitetura

### Route Handler, não Server Action

A exportação é um `GET` em `app/api/export/*`, consumido por um `<a href download>`. O browser
baixa nativamente.

A alternativa — Server Action devolvendo base64 — foi descartada: o arquivo inteiro atravessaria o
payload do RSC com ~33% de overhead de codificação, e o download exigiria `Blob` +
`URL.createObjectURL` manual no cliente. Gerar o xlsx no browser foi descartado por jogar ~500kb
de biblioteca no bundle sem ganho.

Como `Button` do DS suporta `asChild`, os botões de dashboard, panorama e devedores são
Server Components — um `<a>` estilizado, sem JS. Só o `/historico` precisa de Client Component,
porque os filtros vivem no estado da tela.

### Biblioteca: `write-excel-file@4.1.1`

Versão fixa, sem caret, como o resto do `package.json`.

A escolha inicial era `exceljs`, descartada após verificação: última publicação em outubro de 2023,
e 9 dependências incluindo `unzipper`, `archiver` e `uuid@8` — subsistema de *leitura* de planilhas,
que não usamos.

`write-excel-file` foi publicada em 2026-06-08, tem uma única dependência (`fflate`), tipos
TypeScript inclusos, licença MIT e `engines.node >= 18`. É write-only, exatamente o caso de uso.

API verificada contra o pacote publicado:

- overload de múltiplas abas: `writeXlsxFile(sheets: Sheet[], options)`
- `toBuffer(): Promise<Buffer>` — gera em memória, sem arquivo temporário
- import server-only: `write-excel-file/node`

## Refactor: `collectHistoricoItems`

`getHistoricoFeed` (`lib/queries/historico.ts`) hoje faz busca → merge → filtro `q` → fatia do
cursor numa função só. A parte anterior à paginação é extraída:

```ts
export async function collectHistoricoItems(
  userId: string,
  params: HistoricoParams
): Promise<HistoricoFeedItem[]>
```

`getHistoricoFeed` passa a ser fino: chama `collectHistoricoItems` e aplica a fatia do cursor.
Comportamento idêntico — `__tests__/unit/historico-merge.test.ts` continua valendo sem alteração.

O ganho é que a exportação percorre exatamente o mesmo caminho que alimenta a tela, incluindo o
decrypt via DEK e o filtro em JS dos gastos fixos por `dueDay`. O arquivo baixado nunca diverge
do que o usuário vê.

## Módulos novos

```
lib/export/
  xlsx.ts            encanamento compartilhado
  extrato-xlsx.ts    construtor de linhas do extrato
  devedores-xlsx.ts  construtor de linhas dos devedores
```

`xlsx.ts` concentra estilo de cabeçalho, larguras de coluna e `toXlsxResponse(buffer, filename)`,
que monta o `Content-Disposition`.

Cada construtor separa a regra pura da escrita do arquivo:

- `buildExtratoRows(items: HistoricoFeedItem[]): Row[]` — pura, sem I/O. É onde mora o sinal do
  valor, os rótulos em pt-BR e a formatação de parcela. Testável sem banco.
- `writeExtratoXlsx(items): Promise<Buffer>` — chama a anterior e delega à lib.

O mesmo par existe em `devedores-xlsx.ts`.

## Rota: `GET /api/export/extrato`

Query params idênticos aos do `/historico`, parseados pelo **mesmo** `parseHistoricoParams` —
o contrato dos filtros não é duplicado.

Fluxo: `auth()` → `parseHistoricoParams(searchParams)` → `collectHistoricoItems` → teto →
`writeExtratoXlsx` → resposta.

Nome do arquivo: `mare-extrato-<de>-a-<ate>.xlsx`, ex. `mare-extrato-2026-01-01-a-2026-12-31.xlsx`.

### Colunas

| Coluna | Tipo de célula | Formato | Observação |
| --- | --- | --- | --- |
| Data | `Date` | `dd/mm/yyyy` | data real, ordenável e filtrável no Excel |
| Tipo | texto | — | Saída avulsa / Saída fixa / Saída parcelada / Entrada / Investimento / Resgate |
| Descrição | texto | — | `item.name` |
| Valor | `Number` | `#,##0.00` | com sinal, ver abaixo |
| Categoria | texto | — | vazio quando não se aplica |
| Conta | texto | — | vazio quando não se aplica |
| Parcela | texto | — | `3/12`, vazio nos demais |
| Investimento | texto | — | nome do tipo, em aportes e resgates |

Cabeçalho em negrito, painel congelado na linha 1, larguras definidas por coluna.

### Sinal do valor

Coluna única com sinal, para que somar a coluna inteira reproduza o saldo do período.

| `kind` | Sinal |
| --- | --- |
| `saida_avulsa`, `saida_fixa`, `saida_parcelada` | negativo |
| `investimento` | negativo |
| `entrada`, `resgate` | positivo |

Aporte entra negativo por coerência com o app: em `getDashboardData` o total investido é subtraído
do saldo.

## Rota: `GET /api/export/devedores`

Param opcional `?pessoa=<uuid>`:

- **sem `pessoa`** → duas abas (Saldos + Lançamentos)
- **com `pessoa`** → uma aba, os lançamentos daquela pessoa

Ownership não precisa de `assertOwnsPerson`: `getPersonDebtDetails(userId, personId)` já filtra por
`userId` e devolve `null` para id de outro usuário, o que vira 404.

Nome do arquivo: `mare-devedores-<hoje>.xlsx`, ou `mare-devedores-<slug-do-nome>-<hoje>.xlsx` no
caso individual.

### Aba "Saldos"

Pessoa · Email · Telefone · Saldo (`Number`) · Último movimento (`Date`) · Situação (Ativo/Arquivado)

Fonte: `getPeopleWithBalances(userId)`, que já existe.

### Aba "Lançamentos"

Pessoa · Data (`Date`) · Tipo · Descrição · Valor (`Number`) · Mês de referência · Status · Observações

Rótulos de tipo: Cobrança / Pagamento / Ajuste.

Sinal: cobrança positiva, pagamento negativo, ajuste como armazenado. Segue a convenção do domínio
(`balance > 0` = a pessoa deve a você), então somar a coluna de uma pessoa reproduz o saldo dela na
aba Saldos — os dois números se conferem dentro do próprio arquivo.

### Query nova: `getAllDebtorEntries`

Em `lib/queries/debtors.ts`. Não é possível chamar `getPersonDebtDetails` em laço — seriam N queries.
Faz um select bulk de `debtorEntries` + `people` e junta em JS.

Agregação em JS é obrigatória aqui de qualquer forma: os campos vêm cifrados pela DEK, então `JOIN`
e `GROUP BY` sobre eles no SQL não funcionariam (ver `.claude/crypto.md`).

## Pontos de entrada

**`/panorama`** — o botão existe e está `disabled` em `page.tsx:86`. Troca por `<Button asChild>`
envolvendo `<a href download>` com `de=<ano>-01-01&ate=<ano>-12-31`. Nenhum componente novo.

**`/dashboard`** — botão ao lado do `PrivacyToggle`, no `action` do `MonthSelector`. Recorte é o
primeiro e o último dia do mês de referência. Quando `?cycleAccount=` está ativo, a tela mostra um
ciclo de fatura e não o mês — nesse caso o recorte usa `cycleRange.start` / `.end`, senão o arquivo
não bate com a tela.

**`/historico`** — Client Component, porque os filtros estão no estado da tela. Monta a query string
a partir do `HistoricoParams` atual, reaproveitando a lógica de `buildHistoricoUrl` apontada para a
rota da API.

**`/devedores` e `/devedores/[id]`** — botão no header, ambos `<Button asChild>` + `<a download>`.
As três telas já usam o mesmo padrão de header (`flex items-start justify-between gap-4` envolvendo
`PageHeader` + ações), então o botão entra no bloco de ações existente.

## Limites e erros

Teto de **20.000 linhas**. Acima disso a rota responde **413** com uma mensagem legível
("Período muito grande para exportar — reduza o intervalo ou os filtros"), em vez de truncar.

Truncar em silêncio seria pior do que falhar: o usuário baixaria um arquivo incompleto sem sinal
algum e o usaria justamente para conferir totais contra outro app.

Como é navegação direta do browser, a mensagem aparece na aba.

Sem sessão → 401. As rotas são `GET` e só leem: não precisam de `revalidatePath`, e o escopo por
`userId` já vem das queries.

## Testes

O grosso vai nos construtores de linha, que são puros e não tocam no banco:

- `buildExtratoRows`: sinal correto por `kind`; formatação de parcela (`3/12`); categoria e conta
  nulas virando string vazia; data emitida como `Date` e não texto; lista vazia.
- `buildDevedoresRows`: sinal por tipo de lançamento; a soma dos lançamentos de uma pessoa bate com
  o saldo dela na aba Saldos; pessoa sem lançamentos.
- `getHistoricoFeed` continua paginando igual depois da extração de `collectHistoricoItems`.

Nota sobre a regra de coverage do `CLAUDE.md`: `thresholds.perFile` cobre `lib/utils/` e
`lib/validations/`. `lib/export/` não é nenhuma das duas, então não entra — a menos que se decida
estender a regra.

## Riscos

- **Memória na geração.** O buffer é montado inteiro em RAM antes da resposta. Com o teto de 20.000
  linhas e ~8 colunas de texto curto, fica na ordem de poucos MB — dentro do limite de uma função
  serverless. Não vale a complexidade de streaming.
- **Dependência nova em rota de runtime.** `write-excel-file/node` importa `fflate`; nenhuma rota do
  projeto usa `export const runtime = 'edge'`, então o runtime Node padrão atende.
