# Tech Spec: Vencimento, Imposto sobre Resgate e Arquivamento de Tipos

## Contexto

O modulo de investimentos do Maré registra aportes mensais, rendimentos e resgates por
tipo de investimento. O fluxo atual nao distingue investimentos com prazo fixo de
investimentos sem vencimento, e nao permite registrar o imposto descontado em um resgate.

Na prática, investimentos de renda fixa com prazo determinado (CDB, LCI, LCA, caixinhas
com vencimento) vencem em uma data especifica. Quando isso acontece, o valor total é
transferido automaticamente para a conta, com IR descontado na fonte. O usuario precisa
então registrar o resgate, abrir um novo investimento e, opcionalmente, rastrear quanto
pagou de imposto.

O app hoje nao avisa que um investimento está proximo de vencer, nao sugere o resgate no
momento correto e nao oferece campo para registrar o IR no ato do resgate. Isso gera
trabalho manual e perda de informacao.

## Decisão Arquitetural Principal

As duas melhorias sao campos novos em tabelas existentes, sem novo dominio e sem nova
rota.

- `investmentTypes.maturityDate` — data de vencimento opcional, habilita alertas de UI.
- `investmentWithdrawals.taxAmount` — imposto opcional, o `amount` continua sendo o
  valor liquido recebido.
- `investmentTypes.archived` — boolean, default false, oculta o tipo da listagem principal.

Motivo:

- Adicionar colunas nullable/com-default nao quebra nenhum registro existente.
- `grossAmount` é derivado (`amount + taxAmount`) e nao precisa ser persistido.
- Alertas de vencimento sao derivados das informacoes ja existentes sobre saldo; nenhuma
  nova tabela é necessaria para isso.
- O income criado automaticamente quando `destination = 'income'` continua usando o valor
  liquido — o que o usuario efetivamente recebeu na conta.
- Arquivamento é uma operacao de visibilidade, nao de exclusao — historico preservado.

## Objetivo

Permitir que o usuario:

- registre a data de vencimento ao criar ou editar um tipo de investimento;
- veja um badge de alerta no card do tipo quando o vencimento estiver a 30 dias ou menos;
- veja um badge "Vencido" no card quando a data tiver passado e ainda houver saldo;
- acesse rapidamente o dialog de resgate a partir do card vencido, com saldo pre-preenchido;
- veja no dashboard um widget listando investimentos proximos do vencimento ou ja vencidos;
- registre o imposto (IR/IOF) ao criar ou editar um resgate;
- veja o valor bruto, o IR e o valor liquido na tabela de resgates quando houver imposto
  registrado;
- arquive manualmente um tipo de investimento com saldo zero para ocultá-lo da listagem;
- restaure um tipo arquivado a qualquer momento;
- filtre a listagem para ver tipos arquivados via chip na cabecalho da secao.

## Nao Objetivos Da Primeira Versao

- Nao calcular automaticamente o IR com base em tabela regressiva ou prazo.
- Nao calcular IOF automaticamente por periodo.
- Nao classificar investimentos por categoria tributaria (renda fixa, variavel, isento).
- Nao emitir notificacoes fora do app (email, push, SMS).
- Nao arquivar automaticamente ao resgatar saldo total — arquivamento é sempre manual.
- Nao bloquear novos aportes em tipos arquivados — restaurar antes de aportar.
- Nao bloquear novos aportes em tipos com data de vencimento no passado.
- Nao alterar a semantica de `amount` nos resgates — continua sendo o valor liquido.
- Nao excluir dados historicos de tipos arquivados — aportes e resgates sao preservados.

## Modelo De Dados

### Alteracao Em `investment_types`

Adicionar campos:

- `maturityDate`: date, opcional, sem default.
- `archived`: boolean, default `false`, not null.

`maturityDate` representa a data de vencimento do investimento. Quando `null`, o tipo nao tem prazo.

`archived` controla visibilidade na listagem. Quando `true`, o tipo nao aparece na lista
principal (a nao ser que o filtro de arquivados esteja ativo).

Regras de `maturityDate`:

- O campo é editavel a qualquer momento.
- Nao tem impacto em nenhuma restricao ou calculo de saldo.
- Investimentos sem `maturityDate` continuam funcionando exatamente como hoje.

Regras de `archived`:

- So pode ser arquivado se `currentBalance === 0`. A action valida isso antes de mutar.
- Tipos arquivados podem ser restaurados a qualquer momento, independente de saldo.
- Aportes em tipos arquivados sao permitidos — o usuario deve restaurar antes, mas o
  backend nao bloqueia (validacao é de UI).
- Nao tem impacto em nenhum calculo financeiro — patrimonio, panorama e metas ignoram
  o campo `archived`.

### Migration

```sql
ALTER TABLE "investment_types" ADD COLUMN "maturity_date" date;
ALTER TABLE "investment_types" ADD COLUMN "archived" boolean NOT NULL DEFAULT false;
ALTER TABLE "investment_withdrawals" ADD COLUMN "tax_amount" numeric(10, 2);
```

Nenhum backfill necessario. `archived` tem `DEFAULT false`, cobrindo todos os registros
existentes automaticamente.

### Alteracao Em `investment_withdrawals`

Adicionar campo:

- `taxAmount`: decimal(10,2), opcional, sem default.

Representa o imposto retido na fonte (IR ou IOF) no momento do resgate. Quando `null`,
o resgate nao registrou imposto.

Regras:

- `amount` continua sendo o valor liquido recebido (bruto − imposto).
- `grossAmount` é derivado: `amount + taxAmount`. Nao é persistido.
- `taxAmount` deve ser maior ou igual a zero quando informado.
- `taxAmount` nao pode ser maior que `grossAmount` (a validacao garante que `amount > 0`
  mesmo com imposto).
- O income gerado automaticamente quando `destination = 'income'` continua usando
  `amount` (liquido), pois é isso que entra na conta.

### Comandos De Migration

```bash
npm run db:generate
npx prettier --write lib/db/migrations/meta/
npm run db:migrate
```

## Calculo De Alerta De Vencimento

```
daysUntil = differenceInCalendarDays(maturityDate, today)

daysUntil > 30   → sem alerta
daysUntil 1–30  → "Vence em X dias" (warning)
daysUntil = 0   → "Vence hoje" (warning)
daysUntil < 0   → "Vencido há X dias" (negative) — somente se currentBalance > 0
```

Um tipo vencido com saldo zero nao exibe badge — o resgate ja foi feito e o ciclo encerrou.

## Rotas E Navegacao

Nenhuma rota nova. As mudancas tocam:

- `/investimentos` — badges nos cards, tabela de resgates, filtro de arquivados
- `/dashboard` — widget de vencimentos proximos

O filtro de arquivados em `/investimentos` usa o search param `?archived=1`. A page
(Server Component) le esse param e passa `showArchived: true` para `getInvestmentBalances`.
Isso evita estado client-side e permite link direto para a visao arquivada.

## Experiencia Do Usuario

### Tela `/investimentos` — cabecalho da secao "Patrimônio por tipo"

A linha de acao da secao (prop `action` do `<Section>`) exibe:

```
[Arquivados] · 3 tipos ativos · ordenados por valor
```

- `[Arquivados]` é um `<Chip>` com `active={showArchived}`. Clicar navega para
  `?archived=1` (ativo) ou remove o param (inativo). Aparece somente quando
  `archivedCount > 0`.
- O texto de contagem muda conforme o estado:
  - Filtro inativo: `{activeCount} tipo{s} ativo{s}`
  - Filtro ativo: `{archivedCount} tipo{s} arquivado{s}`
- `· ordenados por valor` — `<span className="hidden md:inline">`, sempre presente.

O `<Chip>` fica antes do texto de contagem para não empurrar o botao de criar (mobile)
para fora da linha.

`getInvestmentBalances` passa a aceitar `{ showArchived?: boolean }` e filtra
`archived = false` por padrao (ou `archived = true` quando `showArchived` está ativo).
A query retorna tambem `archivedCount: number` para o chip aparecer so quando necessario.

Alternativa considerada e rejeitada: dropdown "Mostrar arquivados" — mais passos para
chegar ao mesmo resultado; o `Chip` é mais direto e visível.

### Tela `/investimentos` — cards de tipo

Os cards `InvestmentTypeCard` (desktop) e `InvestmentTypeAccordion` (mobile) exibem um
badge de vencimento no header, ao lado do badge de rendimento pendente quando ambos
existem.

Estados do badge de vencimento:

| Condicao | Badge | Variante |
|---|---|---|
| `daysUntil` entre 1 e 30 | Vence em X dias | `warning` |
| `daysUntil` = 0 | Vence hoje | `warning` |
| `daysUntil` < 0 e saldo > 0 | Vencido há X dias | `negative` |
| `daysUntil` < 0 e saldo = 0 | (nenhum) | — |
| `maturityDate` nulo | (nenhum) | — |

Quando o badge for "Vencido", exibir botao "Registrar resgate" no footer do card (ao lado
do botao de "Registrar aporte"). O botao abre o `WithdrawalDialog` com `investmentTypeId`
e `initialAmount` pre-preenchidos com o `currentBalance` do tipo.

### Tela `/investimentos` — arquivar e restaurar via `RowActions`

O `RowActions` de cada card recebe uma `additionalAction` de arquivamento:

- Quando `archived = false` e `currentBalance === 0`:
  mostrar "Arquivar" com `variant: 'default'` e icone `Archive`.
  O click chama a server action `archiveInvestmentType(id)` e revalida a pagina.
- Quando `archived = false` e `currentBalance > 0`:
  a opcao "Arquivar" nao aparece — tipo com saldo nao pode ser arquivado.
- Quando `archived = true`:
  mostrar "Restaurar" com `variant: 'default'` e icone `ArchiveRestore`.
  O click chama `restoreInvestmentType(id)` e revalida.

Cards de tipos arquivados (`archived = true`) exibem visual atenuado:
- Opacidade reduzida no avatar de cor (`opacity-50`).
- Badge `<Badge variant="muted">Arquivado</Badge>` no header, ao lado do nome.
- Sem badge de vencimento (irrelevante para tipo encerrado).
- Footer sem botao de aporte (nao bloqueia no backend, mas remove o CTA).

### Tela `/dashboard` — widget de vencimentos

Renderizar `<Section title="Vencimentos próximos">` acima da secao de investimentos,
somente quando houver ao menos um alerta ativo.

Cada linha do widget exibe:

- Avatar colorido com iniciais do tipo de investimento.
- Nome do tipo + badge de vencimento.
- Saldo atual formatado.
- Botao "Resgatar" que abre `WithdrawalDialog` controlado.

O widget usa `getMaturityAlerts(userId)` (nova query). Se `maturityAlerts.length === 0`,
o widget nao é renderizado.

### Formulario `WithdrawalDialog` — com imposto

O dialog de resgate recebe um toggle "Houve desconto de imposto?". Por padrao, esta
desligado (comportamento atual preservado).

Quando o toggle esta desligado:

- Campo unico "Valor recebido (R$)" — comportamento atual.

Quando o toggle esta ligado:

- Campo "Valor bruto (R$)" — valor antes do desconto.
- Campo "Imposto (IR/IOF) (R$)" — imposto retido.
- Texto derivado somente leitura: "Valor liquido: R$ X" (bruto − imposto).
- O `amount` submetido ao servidor é o valor liquido calculado.
- O `taxAmount` submetido é o imposto informado.

O income criado automaticamente (quando `destination = 'income'`) usa o valor liquido,
que é o que efetivamente entra na conta.

### Tabela de resgates em `/investimentos`

A coluna "Valor" passa a exibir, quando `taxAmount` estiver preenchido, o valor liquido
na linha principal e o detalhamento abaixo em texto caption:

```
− R$ 4.800,00
Bruto R$ 5.000,00 · IR R$ 200,00
```

Quando `taxAmount` for null, exibe apenas o valor liquido, exatamente como hoje.

## Backend

### Atualizar `lib/utils/date.ts`

Adicionar helper:

```typescript
/** Returns number of calendar days until dateStr (positive = future, negative = past). */
export function daysUntil(dateStr: string): number {
  return differenceInCalendarDays(parseDate(dateStr), new Date())
}
```

`differenceInCalendarDays` ja é importado no arquivo.

### Atualizar `lib/validations/investments.ts`

**`investmentTypeSchema`** — adicionar campo opcional:

```typescript
maturityDate: dateSchema.optional().or(z.literal('')),
```

Aceita string vazia para o caso de reset via `<input type="date">`.

**`withdrawalBase`** — adicionar campo:

```typescript
taxAmount: nullishNonNegativeAmountSchema,
```

`amount` continua como `positiveAmountSchema` (valor liquido > 0). A combinacao ja
rejeita casos onde `grossAmount - taxAmount <= 0` sem precisar de `.refine()` adicional.

Atualizar tipos de input das actions (`CreateWithdrawalInput`, `UpdateWithdrawalInput`)
para incluir `taxAmount?: string | null`.

### Atualizar `lib/actions/investments.ts`

**`createInvestmentType` e `updateInvestmentType`** — adicionar `maturityDate` ao input.
Passar `maturityDate: data.maturityDate || null` nos `.values()` e `.set()`.

**`createWithdrawal`** — adicionar `taxAmount: data.taxAmount || null` ao `.values()`.
O income criado continua usando `data.amount` (liquido) — sem alteracao de logica.

**`updateWithdrawal`** — adicionar `taxAmount` ao `.set()`. O income vinculado continua
sendo atualizado com `data.amount` (liquido).

**`archiveInvestmentType(id: string)`** — nova action:

```typescript
// Ordem obrigatoria: requireUserId → assertOwnsInvestmentType → check saldo → UPDATE
async function archiveInvestmentType(id: string) {
  const userId = await requireUserId()
  await assertOwnsInvestmentType(userId, id)
  // buscar currentBalance para validar (reutilizar getInvestmentBalances ou query direta)
  // se currentBalance > 0: throw new Error('Nao é possivel arquivar tipo com saldo.')
  await db.update(investmentTypes).set({ archived: true }).where(eq(investmentTypes.id, id))
  revalidatePath('/investimentos')
}
```

**`restoreInvestmentType(id: string)`** — nova action (sem validacao de saldo):

```typescript
async function restoreInvestmentType(id: string) {
  const userId = await requireUserId()
  await assertOwnsInvestmentType(userId, id)
  await db.update(investmentTypes).set({ archived: false }).where(eq(investmentTypes.id, id))
  revalidatePath('/investimentos')
}
```

`deleteWithdrawal` nao precisa de alteracao.

### Atualizar `lib/queries/investments.ts`

**`getInvestmentBalances`** — aceitar `{ showArchived?: boolean }` como segundo argumento.
Adicionar `WHERE archived = {showArchived ? true : false}` ao filtro existente.
Incluir `maturityDate: type.maturityDate` e `archived: type.archived` no retorno de cada tipo.

Para o chip de contagem, a funcao pode retornar um segundo valor ou a page pode fazer
uma query separada simples de `COUNT(*) WHERE archived = true AND userId = ?`.
Recomendacao: query separada para nao poluir o shape de `getInvestmentBalances`.

**`getInvestmentWithdrawals`** — adicionar `taxAmount: r.taxAmount !== null ? toAmount(r.taxAmount) : null`
ao objeto mapeado.

**Nova funcao `getMaturityAlerts`**:

```typescript
export async function getMaturityAlerts(userId: string) {
  // Apenas tipos ativos (nao arquivados) entram nos alertas
  const balances = await getInvestmentBalances(userId, { showArchived: false })
  return balances
    .filter((b) => b.maturityDate !== null && b.currentBalance > 0)
    .map((b) => ({
      id: b.id,
      name: b.name,
      color: b.color,
      bgColor: b.bgColor,
      maturityDate: b.maturityDate!,
      currentBalance: b.currentBalance,
      daysUntil: daysUntil(b.maturityDate!),
    }))
    .filter((b) => b.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil)
}
```

Reutiliza `getInvestmentBalances` — o dashboard nao chama essa funcao hoje, entao nao
ha query duplicada.

## Frontend

### Atualizar `InvestmentTypeDialog`

Adicionar campo ao formulario:

```tsx
<Field label="Data de vencimento" hint="Opcional – para investimentos com prazo">
  <Input name="maturityDate" type="date" />
</Field>
```

Em modo edicao: `defaultValue={type.maturityDate ?? ''}`.

Incluir `maturityDate` no parse do FormData e na chamada da action correspondente.

### Atualizar `InvestmentTypeCard` e `InvestmentTypeAccordion`

O tipo `Balance` recebe `maturityDate: string | null` e `archived: boolean`.

Calcular o badge de vencimento no componente:

```typescript
const maturityDays = balance.maturityDate ? daysUntil(balance.maturityDate) : null
```

Renderizar badge ao lado do badge de rendimento pendente (omitir em tipos arquivados):

- `maturityDays !== null && maturityDays > 0 && maturityDays <= 30`:
  `<Badge variant="warning">Vence em {maturityDays} dia{maturityDays !== 1 ? 's' : ''}</Badge>`
- `maturityDays !== null && maturityDays === 0`:
  `<Badge variant="warning">Vence hoje</Badge>`
- `maturityDays !== null && maturityDays < 0 && balance.currentBalance > 0`:
  `<Badge variant="negative">Vencido há {Math.abs(maturityDays)} dia{Math.abs(maturityDays) !== 1 ? 's' : ''}</Badge>`

Quando o badge for "Vencido", exibir botao "Registrar resgate" no footer do card.
Esse botao usa `WithdrawalDialog` com `open`/`onOpenChange` controlados pelo card,
`initialTypeId={balance.id}` e `initialAmount={balance.currentBalance}`.

Quando `archived = true`:
- Badge `<Badge variant="muted">Arquivado</Badge>` no header (sem badges de vencimento).
- Avatar com `opacity-50`.
- Footer sem botao de aporte.
- `RowActions` exibe "Restaurar" via `additionalActions` (chama `restoreInvestmentType`).

Quando `archived = false` e `currentBalance === 0`:
- `RowActions` exibe "Arquivar" via `additionalActions` (chama `archiveInvestmentType`).
- Icone sugerido: `Archive` do Lucide.

### Atualizar `WithdrawalDialog`

Adicionar props opcionais para uso externo (cards de vencimento e widget do dashboard):

```typescript
type Props = {
  investmentTypes: { id: string; name: string }[]
  initialTypeId?: string
  initialAmount?: number
  open?: boolean
  onOpenChange?: (v: boolean) => void
}
```

Quando `open`/`onOpenChange` sao fornecidos, nao renderizar o botao trigger — mesmo
padrao de `InvestmentEntryDialog`, `TransactionEditButton` e `IncomeEditButton`.

Estado novo para o toggle de imposto:

```typescript
const [hasTax, setHasTax] = useState(false)
const [grossStr, setGrossStr] = useState('')
const [taxStr, setTaxStr] = useState('')
const netAmount = parseFloat(grossStr || '0') - parseFloat(taxStr || '0')
```

Toggle usando `<Switch label="Houve desconto de imposto?" checked={hasTax} onChange={setHasTax} />`.

Quando `hasTax`:
- `CurrencyInput` controlado para valor bruto → `grossStr`.
- `CurrencyInput` controlado para imposto → `taxStr`.
- Texto somente leitura com valor liquido.
- `<input type="hidden" name="amount" value={netAmount > 0 ? String(netAmount) : ''} />`.
- `<input type="hidden" name="taxAmount" value={taxStr} />`.

Limpar `hasTax`, `grossStr` e `taxStr` em `handleOpenChange(false)`.

### Atualizar `WithdrawalEditButton`

Mesma logica do toggle: se `withdrawal.taxAmount !== null`, inicializar `hasTax = true`,
`grossStr = String(withdrawal.amount + withdrawal.taxAmount)`,
`taxStr = String(withdrawal.taxAmount)`.

Incluir `taxAmount` na chamada de `updateWithdrawal`.

### Criar `components/dashboard/MaturityAlerts.tsx`

Componente client. Recebe `alerts: MaturityAlert[]` e `investmentTypes`.

Renderiza lista compacta de alertas. Cada item:
- Avatar colorido com iniciais do tipo.
- Nome + badge de vencimento (mesma logica dos cards).
- Saldo atual.
- Botao "Resgatar" que abre `WithdrawalDialog` controlado com tipo e saldo pre-preenchidos.

Usar `EmptyState` se `alerts.length === 0` — mas o pai nao renderiza o componente nesse
caso, entao o empty state é apenas uma seguranca.

### Atualizar `app/(app)/dashboard/page.tsx`

Adicionar `getMaturityAlerts(userId)` ao `Promise.all` existente. Renderizar
`<MaturityAlerts alerts={maturityAlerts} investmentTypes={investmentTypes} />`
dentro de `<Section title="Vencimentos próximos">` somente quando
`maturityAlerts.length > 0`.

### Atualizar `app/(app)/investimentos/page.tsx`

Ler `searchParams.archived` e passar `showArchived = params.archived === '1'` para
`getInvestmentBalances`. Calcular `archivedCount` via query separada.

Na prop `action` da `<Section title="Patrimônio por tipo">`:

```tsx
<div className="flex items-center gap-2">
  {archivedCount > 0 && (
    <Chip
      active={showArchived}
      onClick={/* navegar para ?archived=1 ou remover param */}
    >
      Arquivados
    </Chip>
  )}
  <span className="whitespace-nowrap text-caption tabular-nums text-text-tertiary">
    <strong className="font-semibold text-text-primary">
      {showArchived ? archivedCount : activeCount}
    </strong>{' '}
    {showArchived
      ? archivedCount === 1 ? 'tipo arquivado' : 'tipos arquivados'
      : activeCount === 1 ? 'tipo ativo' : 'tipos ativos'}
    <span className="hidden md:inline"> · ordenados por valor</span>
  </span>
  {/* botao de criar — mobile only, apenas quando nao esta em view arquivados */}
  {!showArchived && balances.length > 0 && (
    <div className="lg:hidden">
      <InvestmentTypeDialog mode="create" />
    </div>
  )}
</div>
```

O `Chip` precisa de navegacao client-side (router.push/replace). A page é Server Component
— a solucao padrao é converter a `action` da Section para um pequeno componente client
`<ArchivedFilterChip count={archivedCount} active={showArchived} />` que usa `useRouter`.

Na celula "Valor" da tabela de resgates:

```tsx
<div>
  <span className="tabular-nums">− {formatCurrency(w.amount)}</span>
  {w.taxAmount !== null && (
    <span className="block text-caption text-text-tertiary tabular-nums">
      Bruto {formatCurrency(w.amount + w.taxAmount)} · IR {formatCurrency(w.taxAmount)}
    </span>
  )}
</div>
```

## Impacto Em Outros Modulos

### Dashboard

- `totalInvested` no summary continua sendo `sum(investments.amount)` onde
  `excludeFromCashFlow = false`. Tipos arquivados nao afetam esse calculo.
- O income criado no resgate continua usando `amount` (liquido). Nenhuma alteracao.
- Widget de vencimentos é adicionado acima da secao de investimentos, somente quando
  houver alertas. Tipos arquivados nao entram no widget.

### Panorama Anual

- `totalInvested` em `getAnnualOverview` continua somando `investments.amount`. Sem
  alteracao — aportes em tipos arquivados continuam no historico.
- `taxAmount` nao entra em nenhum calculo de saldo ou fluxo de caixa.

### Metas

- `goalContributions` nao é afetado. Sem alteracao.

## Fases De Implementacao

### Fase 1: Schema e migration ✓ concluida (28/05/2026)

1. Adicionar `maturityDate` e `archived` em `investmentTypes` e `taxAmount` em
   `investmentWithdrawals` no `lib/db/schema.ts`.
2. Rodar `npm run db:generate`, formatar meta e `npm run db:migrate`.
3. Adicionar `daysUntil` em `lib/utils/date.ts`.

Criterio de aceite: migration aplicada sem erros, tipos Drizzle compilando.

Resultado: migration `0011_motionless_rictor.sql` aplicada. `npm run typecheck` sem erros.

### Fase 2: Backend ✓ concluida (28/05/2026)

1. Atualizar `lib/validations/investments.ts` com `maturityDate` e `taxAmount`.
2. Atualizar `lib/actions/investments.ts`: propagar `maturityDate` e `taxAmount`,
   adicionar `archiveInvestmentType` e `restoreInvestmentType`.
3. Atualizar `lib/queries/investments.ts`: propagar `maturityDate`, `archived` e
   `taxAmount`; aceitar `showArchived` em `getInvestmentBalances`; adicionar
   `getMaturityAlerts` e query de contagem de arquivados.

Criterio de aceite: `npm run typecheck` sem erros, `npm test` passando.

Resultado: typecheck e lint sem erros. Exportados `InvestmentBalance` e `MaturityAlert`
como tipos derivados de `ReturnType` para manter sincronismo automatico.

### Fase 3: Feature de vencimento (UI) ✓ concluida (28/05/2026)

1. Atualizar `InvestmentTypeDialog` com campo de data de vencimento.
2. Atualizar `InvestmentTypeCard` e `InvestmentTypeAccordion` com badges de alerta.
3. Criar `components/dashboard/MaturityAlerts.tsx`.
4. Atualizar `app/(app)/dashboard/page.tsx` para chamar `getMaturityAlerts` e renderizar
   o widget.

Criterio de aceite:
- Criar tipo com `maturityDate` → badge aparece no card.
- Tipo com `maturityDate` no passado e saldo > 0 → badge "Vencido" + botao "Registrar resgate".
- Dashboard exibe widget somente quando ha alertas ativos.
- Tipo sem `maturityDate` nao exibe nenhum badge novo.

Resultado: `InvestmentTypeDialog` recebe campo `maturityDate`; `InvestmentTypeCard` e
`InvestmentTypeAccordion` (refatorado em `AccordionItem` com estado por tipo) exibem badge
via helper `MaturityBadge`; botao "Registrar resgate" abre `WithdrawalDialog` controlado
pre-preenchido; dashboard chama `getMaturityAlerts` no `Promise.all` e renderiza
`<Section title="Vencimentos próximos">` condicionalmente.

### Fase 4: Feature de imposto (UI) ✓ concluida (28/05/2026)

1. ✓ Atualizar `WithdrawalDialog` com toggle de imposto e props de pre-preenchimento.
2. ✓ Atualizar `WithdrawalEditButton` com a mesma logica de toggle.
3. ✓ Atualizar tabela de resgates em `app/(app)/investimentos/page.tsx`.

Criterio de aceite:
- Registrar resgate sem toggle → comportamento atual preservado, `taxAmount = null`.
- Registrar resgate com toggle → tabela mostra bruto / IR / liquido.
- Editar resgate com `taxAmount` preenchido → toggle inicializa ativo com valores corretos.
- O income criado no resgate usa o valor liquido.

Resultado: `WithdrawalDialog` aceita `initialTypeId`, `initialAmount`, `open`,
`onOpenChange`; toggle "Sim, houve IR ou IOF" exibe campos de valor bruto e imposto,
calcula valor liquido derivado e submete via inputs hidden; `WithdrawalEditButton` inicializa
`hasTax`, `grossCents` e `taxCents` a partir do resgate existente. Coluna "Valor" da tabela
de resgates exibe `− R$ 4.800,00` na linha principal e `Bruto R$ 5.000,00 · IR R$ 200,00`
abaixo em text-caption quando `taxAmount != null`. Corrigido tambem token incorreto
`text-negative-text` → `text-negative` que pre-existia na celula.

### Fase 5: Feature de arquivamento (UI) ✓ concluida (28/05/2026)

1. ✓ Atualizar `InvestmentTypeCard` e `InvestmentTypeAccordion`:
   - Visual atenuado + badge "Arquivado" quando `archived = true`.
   - Opcao "Arquivar" no `RowActions` quando `archived = false` e `currentBalance === 0`.
   - Opcao "Restaurar" no `RowActions` quando `archived = true`.
2. ✓ Criar `components/investimentos/ArchivedFilterChip.tsx` (client component com `useRouter`).
3. ✓ Atualizar `app/(app)/investimentos/page.tsx`:
   - Ler `searchParams.archived`, passar `showArchived` para `getInvestmentBalances`.
   - Incluir `<ArchivedFilterChip>` e contagem correta na `action` da Section.

Criterio de aceite:
- Tipo com saldo zero → kebab exibe "Arquivar".
- Tipo com saldo > 0 → kebab nao exibe "Arquivar".
- Tipo arquivado → visual atenuado + badge "Arquivado" + kebab exibe "Restaurar".
- Chip "Arquivados" aparece somente quando ha ao menos um arquivado.
- Clicar no chip alterna entre visao ativa e arquivada.
- Contagem e texto na Section refletem o estado do filtro.

Resultado: page le `searchParams: Promise<{ archived?: string }>` (padrao Next.js 16),
deriva `showArchived = params.archived === '1'` e passa para `getInvestmentBalances`;
`getArchivedCount` adicionado ao `Promise.all` separado da query principal para nao poluir
o shape. `ArchivedFilterChip` integrado na `action` da Section — aparece somente quando
`archivedCount > 0`. Contagem e texto alternam corretamente por estado do filtro. Hero e
grafico de evolucao ocultos na view arquivada (`!showArchived`) para evitar exibir dados
parciais derivados apenas dos tipos arquivados. EmptyState na view arquivada omite botao
de criar.

### Fase 6: Testes e revisao ✓ concluida (28/05/2026)

1. ✓ Adicionar casos em `__tests__/unit/validations-domain.test.ts`:
   - `investmentTypeSchema` aceita `maturityDate` valido.
   - `investmentTypeSchema` aceita string vazia para `maturityDate`.
   - `investmentTypeSchema` aceita `undefined` para `maturityDate`.
   - `investmentTypeSchema` rejeita formato invalido de `maturityDate`.
   - `withdrawalSchema` aceita `taxAmount: null`.
   - `withdrawalSchema` aceita `taxAmount: '0'`.
   - `withdrawalSchema` aceita `taxAmount` positivo.
   - `withdrawalSchema` rejeita `taxAmount` negativo.
2. ✓ Adicionar casos em `__tests__/integration/investments.test.ts`:
   - Insert com `maturityDate` preenchido e verificacao de retorno.
   - `maturityDate` e `archived` sao null/false por padrao.
   - Insert de withdrawal com `taxAmount` preenchido e verificacao de retorno.
   - `taxAmount` e null por padrao.
3. ✓ Criar `__tests__/integration/actions-investments.test.ts`:
   - `archiveInvestmentType` com saldo zero → `archived = true`.
   - `archiveInvestmentType` com saldo > 0 → lanca erro.
   - `archiveInvestmentType` com aportes + resgates zerados (saldo = 0) → `archived = true`.
   - `restoreInvestmentType` → `archived = false`.
   - Verifica ownership em `restoreInvestmentType`.
4. ✓ Suite completa: lint + format:check + typecheck + unit tests — todos passando.

Resultado: 8 novos casos unitarios em `validations-domain.test.ts`; 5 novos casos DB-level em
`investments.test.ts`; arquivo `actions-investments.test.ts` criado com 5 casos de action com
banco real. `vi.mock('next/cache', ...)` necessario — `revalidatePath` lanca sem contexto Next.js.

## Bugs Identificados Na Revisao Pos-Implementacao

### B1 — `investmentTypeOptions` filtrado por `showArchived` na page de investimentos

**Arquivo:** `app/(app)/investimentos/page.tsx`
**Gravidade:** funcional

```typescript
// atual — errado
const investmentTypeOptions = balances.map((b) => ({ id: b.id, name: b.name }))
```

`balances` já está filtrado pelo parâmetro `showArchived`. Quando o usuário está na view
`?archived=1`, o `WithdrawalDialog` no header da seção "Resgates" recebe apenas tipos
arquivados (saldo zero → dropdown vazio ou inútil). O `WithdrawalEditButton` sofre do
mesmo problema ao editar resgates históricos nessa view.

**Correção:** buscar tipos ativos separadamente, independente do filtro de view.
Opção simples: adicionar `getInvestmentTypes(userId)` ao `Promise.all` e usar esse array
para `investmentTypeOptions`.

**Status:** resolvido (28/05/2026)

---

### B2 — `initialAmount` ignorado quando o toggle de imposto é ativado

**Arquivo:** `components/investimentos/WithdrawalDialog.tsx`
**Gravidade:** UX (pré-preenchimento perdido)

```typescript
// atual — grossCents sempre começa em 0, ignora initialAmount
const [grossCents, setGrossCents] = useState(0)
```

Quando o dialog abre pré-preenchido (card vencido ou widget do dashboard com
`initialAmount`) e o usuário ativa o toggle de imposto, o campo "Valor bruto" começa em
R$ 0,00. O pré-preenchimento só funciona no modo sem imposto.

**Correção:**

```typescript
const [grossCents, setGrossCents] = useState(() =>
  initialAmount ? Math.round(initialAmount * 100) : 0
)
```

**Status:** resolvido (28/05/2026)

---

### B3 — Accordion nao exibe badge de rendimento pendente quando há badge de vencimento

**Arquivo:** `components/investimentos/InvestmentTypeAccordion.tsx`
**Gravidade:** discrepância spec vs implementação

No `InvestmentTypeCard` (desktop) ambos os badges aparecem juntos na linha do nome. No
accordion, quando `pendingYield=true` e `maturityDate` está próxima/vencida, o header
exibe apenas o badge de vencimento — o rendimento pendente fica como texto "pend." na
coluna de valor (invisível no header fechado). A spec diz explicitamente "ao lado do
badge de rendimento pendente quando ambos existem".

```tsx
// atual — falta badge de pendingYield
{balance.archived ? (
  <Badge variant="muted">Arquivado</Badge>
) : (
  <MaturityBadge ... />
)}

// deveria ser
{balance.archived ? (
  <Badge variant="muted">Arquivado</Badge>
) : (
  <>
    {balance.pendingYield && (
      <Badge variant="warning">
        pend.{pendingMonthLabel ? ` ${pendingMonthLabel}` : ''}
      </Badge>
    )}
    <MaturityBadge ... />
  </>
)}
```

**Status:** resolvido (28/05/2026)

---

### B5 — `taxAmount` nao deduzido do saldo do investimento

**Arquivos:** `lib/queries/investments.ts` (duas funções)
**Gravidade:** crítico (saldo incorreto)

Quando um resgate tem `taxAmount`, o `amount` persistido é o valor líquido (bruto − imposto).
A query que calcula `currentBalance` soma apenas `amount` nos resgates, então o imposto pago
**fica contabilizado como se ainda estivesse no investimento**.

Exemplo: tipo com R$ 500 → resgate bruto R$ 500, IR R$ 50, líquido R$ 450.
- `totalWithdrawn = 450` (amount salvo)
- `currentBalance = 500 − 450 = 50` ← errado, deveria ser 0

O mesmo problema afeta `getPatrimonyTimeline`:

```typescript
// getInvestmentBalances — linha 34
db.select({ totalWithdrawn: sum(investmentWithdrawals.amount) })

// getPatrimonyTimeline — linha 182
monthMap.set(month, prev - Number(wd.amount))
```

Ambos deveriam usar o valor bruto (`amount + coalesce(taxAmount, 0)`).

**Correção em `getInvestmentBalances`:** trocar a query de resgates para somar gross:

```typescript
db
  .select({
    totalWithdrawn: sql<string>`
      coalesce(sum(${investmentWithdrawals.amount}
        + coalesce(${investmentWithdrawals.taxAmount}, 0)), 0)
    `,
  })
  .from(investmentWithdrawals)
  ...
```

**Correção em `getPatrimonyTimeline`:**

```typescript
monthMap.set(month, prev - Number(wd.amount) - Number(wd.taxAmount ?? 0))
```

Atenção: `getMaturityAlerts` chama `getInvestmentBalances`, então é corrigido
automaticamente. O critério `currentBalance > 0` para exibir badge "Vencido" também
passa a ser calculado corretamente após a fix.

**Status:** resolvido (28/05/2026)

---

### B6 — Source do income criado no resgate é genérico

**Arquivo:** `lib/actions/investments.ts`
**Gravidade:** UX / rastreabilidade

```typescript
// atual
source: 'Resgate de investimento',
```

Quando o destino do resgate é `'income'`, o income criado sempre recebe o source
`"Resgate de investimento"`, sem identificar qual tipo. Com múltiplos investimentos, a
lista de entradas no dashboard fica cheia de linhas idênticas.

**Correção:** incluir o nome do tipo no source.

Formato sugerido: `"Resgate investimento <nome do tipo>"` (sem o "de", para ficar mais
compacto na lista de entradas).

Implementação:
- Adicionar `investmentTypeName: string` a `CreateWithdrawalInput`.
- Buscar o nome a partir de `data.investmentTypeId` **ou** receber do caller.
- Recomendação: receber do caller para evitar query extra. Os componentes que chamam
  `createWithdrawal` já têm acesso ao nome (dropdown selecionado).
- Atualizar `WithdrawalDialog` e `WithdrawalEditButton` para passar o nome.

**Status:** resolvido (28/05/2026)

---

### B4 — `archive`/`restoreInvestmentType` sem `userId` no WHERE da mutação

**Arquivo:** `lib/actions/investments.ts`
**Gravidade:** menor (defesa em profundidade)

```typescript
// atual — WHERE sem userId, depende exclusivamente do assert anterior
await db.update(investmentTypes).set({ archived: true }).where(eq(investmentTypes.id, id))
```

`assertOwnsInvestmentType` garante a segurança antes da mutação, mas o `WHERE` não inclui
`userId`. Se o assert for removido no futuro, o UPDATE fica desprotegido. Padrão consistente
com o restante do projeto seria incluir `and(eq(investmentTypes.id, id), eq(investmentTypes.userId, userId))`.

**Status:** resolvido (28/05/2026)

---

### B7 — `ArchivedFilterChip` some ao restaurar o último tipo arquivado

**Arquivo:** `components/investimentos/ArchivedFilterChip.tsx`
**Gravidade:** UX (usuário fica preso na view arquivada sem poder voltar)

```typescript
// atual — oculta o chip quando count = 0, mesmo na view ativa
if (count === 0) return null
```

Quando o usuário restaura o último tipo arquivado, `archivedCount` vai a zero e o chip
desaparece. Se o usuário ainda está em `?archived=1`, não há como navegar de volta à
listagem normal.

**Correção:** manter o chip visível quando `active = true`, independente de `count`:

```typescript
if (count === 0 && !active) return null
```

**Status:** resolvido (28/05/2026)

---

## Questoes Para Decidir Durante A Implementacao

1. O botao "Registrar resgate" no card vencido deve ser exibido no desktop e no mobile
   (accordion)?
   - Recomendacao: sim em ambos — o evento de vencimento é relevante independente de
     dispositivo.

2. O widget de vencimentos no dashboard deve aparecer dentro de um `<Card>` ou apenas
   como `<Section>`?
   - Recomendacao: `<Section>` simples, sem card extra — evita nesting desnecessario.

3. O `initialAmount` pre-preenchido no dialog de resgate deve usar `currentBalance` ou
   o usuario deve preencher manualmente?
   - Recomendacao: pre-preencher como sugestao, editavel. O valor bruto do resgate pode
     diferir do saldo calculado pelo app (rendimento nao registrado ainda, por exemplo).

4. O empty state de "nenhum tipo cadastrado" deve aparecer tambem na visao arquivada?
   - Recomendacao: sim — se o usuario navegar para `?archived=1` e nao houver arquivados,
     exibir `EmptyState` com texto "Nenhum tipo arquivado." sem botao de criar.

## Arquivos Provaveis

### Adicionar

- `components/dashboard/MaturityAlerts.tsx`
- `components/investimentos/ArchivedFilterChip.tsx`

### Alterar

- `lib/db/schema.ts`
- `lib/utils/date.ts`
- `lib/validations/investments.ts`
- `lib/actions/investments.ts`
- `lib/queries/investments.ts`
- `components/investimentos/InvestmentTypeDialog.tsx`
- `components/investimentos/InvestmentTypeCard.tsx`
- `components/investimentos/InvestmentTypeAccordion.tsx`
- `components/investimentos/WithdrawalDialog.tsx`
- `components/investimentos/WithdrawalEditButton.tsx`
- `app/(app)/dashboard/page.tsx`
- `app/(app)/investimentos/page.tsx`
- `__tests__/unit/validations-domain.test.ts`
- `__tests__/integration/investments.test.ts`

### Gerar

- `lib/db/migrations/0011_*.sql` (ou proximo numero disponivel)
- `lib/db/migrations/meta/_journal.json` (atualizado pelo Drizzle Kit)

## Ordem Recomendada Para Trabalhar

1. Schema + migration (Fase 1): `maturityDate`, `archived`, `taxAmount`.
2. `daysUntil` em `date.ts`.
3. Validacoes + actions + queries (Fase 2): incluindo `archiveInvestmentType`,
   `restoreInvestmentType` e `showArchived` em `getInvestmentBalances`.
4. `InvestmentTypeDialog` — campo de data de vencimento.
5. `InvestmentTypeCard` + `InvestmentTypeAccordion` — badges de vencimento + botao de
   resgate + visual arquivado + opcoes do `RowActions`.
6. `WithdrawalDialog` — toggle de imposto + props de pre-preenchimento.
7. `WithdrawalEditButton` — mesma logica de toggle.
8. `MaturityAlerts.tsx` + integracao no dashboard.
9. Tabela de resgates em `/investimentos` — detalhamento de imposto.
10. `ArchivedFilterChip.tsx` + integracao no header da Section em `/investimentos`.
11. Testes unitarios e de integracao (Fase 6).
12. Suite completa de lint + typecheck + testes.
