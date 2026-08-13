# Exportação completa da conta

**Data:** 2026-08-13
**Status:** aguardando revisão
**Fecha:** `docs/seo-landing-backlog.md` §6.1, linha "Exportação completa"

## Problema

A landing afirma, em dois lugares, que o usuário pode "exportar tudo em CSV". É falso. Os dois
pontos estão marcados no código com o comentário `PROMESSA SEM LASTRO`
(`app/(marketing)/page.tsx:78` e `components/marketing/FaqSection.tsx:19`), que aponta de volta
para o backlog.

O que existe hoje cobre movimento, não a conta:

| Rota | Cobre | Recorte |
| --- | --- | --- |
| `/api/export/extrato` | transactions, fixedExpenses, incomes, aportes, resgates | janela `de`/`ate` obrigatória |
| `/api/export/devedores` | people (saldos) + debtorEntries | tudo, ou uma pessoa |

Ficam de fora: metas, contribuições de meta, categorias e grupos, orçamentos (padrão e overrides
mensais), contas de pagamento, grupos de parcela, tipos de investimento, e os campos de resgate que
o extrato não carrega (imposto e destino).

Não é só cobertura. **Todo export hoje exige uma janela de data**, e "exportar tudo" não tem
janela — o que muda o desenho, não só a lista de tabelas.

## Escopo

Uma ação: **"Baixar todos os meus dados"**, no `SettingsDialog`, em dois formatos.

| Formato | Artefato |
| --- | --- |
| Excel | `mare-completo-<hoje>.xlsx` — 12 abas |
| CSV | `mare-completo-<hoje>.zip` — 12 arquivos `.csv` |

**Fora de escopo:**

- `userSettings` (pixKey, creditMode, autoRollover). É configuração da conta, não dado financeiro
  do usuário; exportá-la não ajuda ninguém a reconstruir a vida financeira em outra ferramenta.
- Job assíncrono com envio por e-mail. Só se justifica se a montagem síncrona se mostrar lenta —
  medir antes de construir. Ver "Riscos".
- Alterar as rotas `/extrato` e `/devedores` existentes. Elas continuam como estão; a rota nova
  reusa os construtores delas.
- Exclusão de conta. É o outro item de §6.1 e mora ao lado no `SettingsDialog`, mas é trabalho
  próprio, com spec própria.

## Decisões de arquitetura

### Um coletor, dois formatos

`lib/export/full/collect.ts` é a única fonte de verdade do conteúdo:

```ts
export interface ExportSheet {
  name: string          // "Extrato", "Metas — Contribuições"
  filename: string      // "extrato", "metas-contribuicoes" — nome do .csv dentro do zip
  data: SheetData       // já pronto para sheetToCsv ou writeXlsxFile
  widths?: number[]     // larguras de coluna; só o XLSX usa
}

export async function collectFullExport(userId: string): Promise<ExportSheet[]>
```

Daí saem os dois formatos sem nenhuma regra de domínio duplicada: `sheetToCsv(sheet.data)` vira um
arquivo do ZIP, e o array inteiro vira as abas do `writeXlsxFile`. É a mesma simetria que
`devedores-xlsx.ts` já pratica com duas abas, generalizada para doze.

Isso importa porque a alternativa — dois caminhos independentes — garante que os formatos divirjam
com o tempo, e a divergência aparece como "o CSV não bate com o Excel" num arquivo que o usuário
baixou justamente para conferir números.

### `fflate@0.8.3` declarado como dependência direta

Instalar com `--save-exact`, sem caret, como o resto do `package.json`.

O `fflate` **já está na árvore**: `write-excel-file@4.1.1` depende dele, e é assim que o `.xlsx`
(que é um ZIP) é montado hoje. Declará-lo não baixa um byte novo.

A alternativa considerada era escrever um writer ZIP *store-only* à mão — cerca de 80 linhas de
local file headers, central directory, EOCD e CRC32. Foi descartada por três motivos:

1. É código binário escrito por nós num caminho que ninguém inspeciona visualmente. O modo de falha
   é um arquivo que abre em uma ferramenta e não em outra.
2. `unzipSync` torna o teste de round-trip real — extrai e compara conteúdo — em vez de um
   mini-reader que nós mesmos escreveríamos e que concordaria com os nossos próprios erros.
3. A norma deste repo, estabelecida na **issue #71** (o caso do `tsx`), é que o bug é *usar sem
   declarar*, não declarar. Consumir `fflate` por baixo do `write-excel-file` seria repetir
   exatamente o padrão que aquela issue reporta.

Risco aceito: se o `write-excel-file` subir o `fflate` para outro major, o npm passa a instalar duas
cópias. É pequeno, visível no lockfile, e resolvido subindo a nossa declaração junto.

### Route Handler, não Server Action

Mesma decisão do spec de 2026-07-28, pelas mesmas razões: `GET` em `app/api/export/completo`,
consumido por `<a href download>`, download nativo do browser. Como o `Button` do DS suporta
`asChild`, os dois links no `SettingsDialog` são `<a>` estilizados, sem JS de download.

### Sem teto de linhas

O dump completo **ignora `EXPORT_ROW_LIMIT`**, ao contrário das outras duas rotas.

O teto existe nelas porque o usuário tem como reduzir o recorte: estreita o período ou os filtros e
tenta de novo. No dump completo não existe filtro — recusar deixa o usuário sem saída nenhuma, e
justamente o usuário com mais dados, que é quem mais precisa levar os dados embora.

Isso vai como comentário no código, não só aqui. A ausência de um teto num arquivo cujos vizinhos
todos têm teto lê como esquecimento, e a próxima revisão "conserta".

### Recorte temporal do extrato

`collectHistoricoItems` exige `de`/`ate`, e `referenceMonthsInRange` materializa um mês por elemento
num `inArray`. Passar `de = '1970-01-01'` geraria ~670 elementos no `IN` — funciona, e é bobo.

A rota deriva o piso real com uma query nova, `getEarliestActivityDate(userId)`: um `MIN` sobre as
tabelas de movimento (`transactions.date`, `incomes.referenceMonth`, `fixedExpenses.referenceMonth`,
`investments.referenceMonth`, `investmentWithdrawals.date`), devolvendo `null` para conta vazia.
Nesse caso o extrato sai só com o cabeçalho, e o resto do arquivo continua válido.

Note que essas colunas de data **não são cifradas** — só nome, descrição e valor são. O `MIN` em SQL
é legítimo aqui, e é a exceção que a regra de `.claude/crypto.md` permite.

## Conteúdo — 12 planilhas

Ordem fixa, do mais usado para o menos. No ZIP, os arquivos recebem prefixo numérico
(`01-extrato.csv`) para preservar a ordem ao descompactar.

| # | Planilha | Fonte | Query |
| --- | --- | --- | --- |
| 1 | Extrato | histórico completo | `collectHistoricoItems` (existente) |
| 2 | Contas | `paymentAccounts` | `getPaymentAccounts` (existente) |
| 3 | Categorias | `categories` + `categoryGroups` | `getCategoriesWithGroups` (existente) |
| 4 | Orçamentos mensais | `monthlyBudgetOverrides` | **nova** |
| 5 | Parcelas | `installmentGroups` | **nova** |
| 6 | Investimentos — Tipos | `investmentTypes` | `getInvestmentTypes` (existente) |
| 7 | Investimentos — Aportes | `investments` | **nova** |
| 8 | Investimentos — Resgates | `investmentWithdrawals` | `getInvestmentWithdrawals` (existente) |
| 9 | Metas | `goals` | `getGoalsWithProgress` (existente) |
| 10 | Metas — Contribuições | `goalContributions` | **nova** |
| 11 | Devedores — Saldos | `people` | `getPeopleWithBalances` (existente) |
| 12 | Devedores — Lançamentos | `debtorEntries` | `getAllDebtorEntries` (existente) |

### Colunas

Tipos de célula seguem os helpers de `lib/export/xlsx.ts`: `dateCell` (`dd/mm/yyyy`), `moneyCell`
(`#,##0.00`), `textCell` (`type: String`, que impede coerção).

**1. Extrato** — idêntico ao de `/api/export/extrato`, reusando `buildExtratoRows` sem alteração:
Data · Tipo · Descrição · Valor · Categoria · Conta · Parcela · Investimento.

**2. Contas** — Nome · Tipo (Crédito/Débito/Pix) · Dia de fechamento.

**3. Categorias** — Grupo · Categoria · Orçamento padrão · Cor.

**4. Orçamentos mensais** — Mês de referência · Grupo · Categoria · Valor. Uma linha por override;
é o que permite reconstruir o orçamento fora do app.

**5. Parcelas** — Descrição · Valor total · Nº de parcelas · Valor da parcela · Data de início ·
Categoria · Conta · Parcelas pagas · Restantes.

**6. Investimentos — Tipos** — Nome · Meta vinculada · Vencimento · Situação (Ativo/Arquivado).

**7. Investimentos — Aportes** — Mês de referência · Tipo · Aporte · Rendimento · Fora do fluxo de
caixa (Sim/Não) · Observações.

**8. Investimentos — Resgates** — Data · Tipo · Valor líquido · Imposto · Valor bruto · Destino
(Caixa/Reinvestimento/Transferência) · Observações.

O valor bruto é coluna própria e calculada (`amount + taxAmount`), não deixada para o usuário somar:
`investmentWithdrawals.amount` é líquido, e essa é precisamente a distinção que
`.claude/domain.md` registra como fonte de erro recorrente no próprio código.

**9. Metas** — Nome · Valor alvo · Data alvo · Tipo de investimento vinculado · Saldo atual ·
Progresso (%).

**10. Metas — Contribuições** — Meta · Mês de referência · Valor · Origem (Manual/Investimento).

**11 e 12. Devedores** — idênticas às abas atuais, reusando `buildSaldosRows` e
`buildLancamentosRows` sem alteração.

## Queries novas

Cinco, todas pequenas. Todas em `lib/queries/`, todas passando por `getDekForUser` + `decryptField`
— nenhum builder de export toca `db.query.*` direto.

| Query | Arquivo | Por quê |
| --- | --- | --- |
| `getAllInstallmentGroups(userId)` | `lib/queries/parcelas.ts` | `getActiveInstallmentGroups` filtra `remainingInstallments > 0`; no dump isso esconderia todo o histórico já quitado, que é o que o usuário mais quer levar embora |
| `getAllGoalContributions(userId)` | `lib/queries/goals.ts` | `getGoalsWithProgress` devolve só o agregado por meta; as linhas individuais não têm leitura hoje |
| `getAllInvestmentEntries(userId)` | `lib/queries/investments.ts` | `getInvestmentHistory` é por tipo; chamá-la em laço seria N queries |
| `getAllBudgetOverrides(userId)` | `lib/queries/categories.ts` | `getCategoriesWithBudgets` é por mês; o dump precisa de todos os meses |
| `getEarliestActivityDate(userId)` | `lib/queries/historico.ts` | piso do extrato, ver "Recorte temporal" |

`getAllInstallmentGroups` calcula `paidInstallments` pela mesma regra de `getActiveInstallmentGroups`
(`referenceMonth < currentMonthStr` — o mês corrente conta como pendente). A regra não é
reimplementada: as duas passam a compartilhar o helper que hoje vive dentro da primeira.

## Módulos novos

```
lib/export/
  zip.ts                     createZip(files) → Buffer, sobre fflate.zipSync
  full/
    collect.ts               orquestra as queries, devolve ExportSheet[]
    contas.ts                buildContasRows
    categorias.ts            buildCategoriasRows, buildOrcamentosRows
    parcelas.ts              buildParcelasRows
    investimentos.ts         buildTiposRows, buildAportesRows, buildResgatesRows
    metas.ts                 buildMetasRows, buildContribuicoesRows
app/api/export/completo/
  route.ts
```

Cada `build*Rows` é puro: recebe o resultado já decriptado da query e devolve `SheetData`. Sem I/O,
testável sem banco — o mesmo contrato que `buildExtratoRows` já cumpre.

Os builders de extrato e devedores **não são movidos**. Continuam onde estão; `collect.ts` os
importa.

## Rota

`GET /api/export/completo?format=csv` → ZIP. Sem `format` → XLSX.

```
auth() → 401 se sem sessão
collectFullExport(userId)
format === 'csv'
  ? toZipResponse(createZip(sheets.map(csvEntry)), 'mare-completo-<hoje>.zip')
  : toXlsxResponse(await writeFullXlsx(sheets), 'mare-completo-<hoje>.xlsx')
```

`toZipResponse` entra em `lib/export/zip.ts`, espelhando `toXlsxResponse`:
`Content-Type: application/zip`, `Content-Disposition: attachment`, `Cache-Control: no-store`.

Sem parâmetros de recorte, sem ownership check explícito — todas as queries são escopadas por
`userId` na origem. É `GET` e só lê: nada de `revalidatePath`.

## UI

Seção nova **"Seus dados"** em `SettingsContent`
(`components/settings/SettingsDialog.tsx`), entre "Privacidade" e "Zona de perigo" — antes do bloco
destrutivo de propósito: o usuário que está pensando em resetar a conta encontra a saída de dados
antes do botão vermelho.

Dois `<Button asChild>` envolvendo `<a href download>`, seguindo o padrão de rótulo já usado em
dashboard, panorama, histórico e devedores: **"Excel (.xlsx)"** e **"CSV (.zip)"**.

Texto de apoio, uma linha: o que o arquivo contém e que é a conta inteira, sem filtro de período.

Nenhum componente novo do DS. Nenhuma alteração em `components/ui/`.

## Copy da landing

Com a rota no ar, os dois comentários `PROMESSA SEM LASTRO` saem — o de
`components/marketing/FaqSection.tsx:19` e o de `app/(marketing)/page.tsx:78`. A copy em si não
muda: ela passa a ser verdade.

O outro `PROMESSA SEM LASTRO` do FAQ, sobre exclusão de conta, **permanece**. Remover os dois
comentários de uma vez é o erro fácil aqui: o texto do FAQ cobre as duas promessas na mesma frase, e
só metade dela fica verdadeira com este trabalho.

`docs/seo-landing-backlog.md` §6.1: a linha "Exportação completa" sai de **parcial** para
**resolvida**.

## Testes

**Unit — builders** (`__tests__/unit/`), um arquivo por domínio. Para cada um: colunas na ordem
declarada, células com o tipo certo (data como `Date`, valor como `Number`), nulo virando string
vazia, lista vazia produzindo só o cabeçalho.

Casos que só a implementação certa passa:

- **Parcelas** — um grupo com `remainingInstallments === 0` **precisa** aparecer. Um teste com
  apenas grupos ativos passaria igual reusando `getActiveInstallmentGroups`, que é o caminho natural
  de quem implementa — e é o bug.
- **Resgates** — resgate com `taxAmount` não-nulo: o bruto tem que ser `amount + taxAmount`. Um
  teste com `taxAmount` nulo passa com a implementação errada.
- **Orçamentos mensais** — categoria com override em dois meses distintos rende duas linhas. Com um
  mês só, uma implementação que pegasse o mês corrente passaria.

**Unit — ZIP** (`__tests__/unit/export-zip.test.ts`): `createZip` seguido de `unzipSync` devolve os
mesmos nomes e o mesmo conteúdo, byte a byte, incluindo um arquivo com acentos e um com célula
contendo `;` e aspas. É round-trip real, não inspeção de bytes contra a nossa própria expectativa.

**Integração** (`__tests__/integration/export-completo.test.ts`), com usuário populado nos 12
domínios:

1. A rota devolve 200 e as 12 planilhas, na ordem declarada.
2. **Nenhuma célula do dump inteiro casa com `/enc:/`.**

O caso 2 é o mais importante da spec. O risco número um deste trabalho não é formato quebrado — é
vazar ciphertext num arquivo que o usuário abre. São doze domínios atravessando a fronteira de
cripto de uma vez, e `decryptField` é backward-compat: repassa plaintext em silêncio quando o valor
não começa com `enc:`. Um campo esquecido não estoura em lugar nenhum; sai `enc:AAAA...` na
planilha e ninguém sabe até um usuário reclamar. Um assert sobre o dump inteiro pega a classe toda.

Nota de coverage: `thresholds.perFile` no `vitest.config.mts` cobre `lib/utils/` e
`lib/validations/`. `lib/export/` não é nenhuma das duas e continua fora — mesma situação registrada
no spec de 2026-07-28.

## Riscos

- **Memória.** Sem teto, o dump inteiro é montado em RAM antes da resposta. Uma conta de cinco anos
  de uso intenso fica na ordem de poucos MB de texto — dentro de qualquer limite de função
  serverless. Streaming só se justifica com evidência, e não há nenhuma. **Ação:** medir o tamanho
  do buffer numa conta real antes do merge e registrar o número aqui.
- **Latência.** São ~15 queries em `Promise.all` mais o decrypt de tudo em JS. Se passar de alguns
  segundos, o browser fica sem feedback — é `<a href>`, não há spinner. **Ação:** medir junto com o
  item acima. Se doer, o próximo passo é o job assíncrono que este spec deixou fora de escopo, não
  streaming.
- **Divergência entre formatos.** Mitigada por construção: os dois saem do mesmo `ExportSheet[]`.
  Vale um teste que gere os dois e compare a contagem de linhas por planilha.
