# Revisão de Registrar / Editar Lançamento — Design

**Data:** 2026-07-12
**Status:** Aprovado (aguardando revisão do spec)

## Objetivo

Repaginar a experiência de **registrar** e **editar** lançamentos no Maré, com quatro
frentes: consistência criar/editar, polish visual do formulário, redução de fricção de
fluxo, e melhoria do preview da página `/registro`. Restrição inegociável: **todos os
fluxos atuais continuam funcionando retroativamente e nada quebra.**

## Contexto atual

- **Página `/registro`** (`RegistroPageClient`): `TransactionForm` rico num `Card` +
  painel de preview ao vivo à direita (só desktop, `w-72`).
- **Dialog/Drawer de criação** (`RegistrationDialogProvider`): mesmo `TransactionForm`,
  sem preview.
- **Dialogs de edição** (`TransactionEditDialog`, `FixedExpenseEditDialog`,
  `IncomeEditDialog`, além de `InstallmentGroupEditDialog`): formulários **separados e
  crus** — `Field` + `Input` + `Select` nativo + `CurrencyInput`, sem hero colorido, sem
  `CategoryPicker` combobox, sem cor por tipo.

O `TransactionForm` (criação) já tem o ponto forte: hero card colorido por tipo, Segment
de tipo, chips de subtipo, `CategoryPicker`, `SplitSection`. Os edit dialogs não herdam
nada disso — daí a inconsistência.

### Campos e actions por tipo de edição (mapa de compatibilidade)

| Editar        | Campos editáveis                              | Action / Schema                          |
| ------------- | --------------------------------------------- | ---------------------------------------- |
| saída avulsa  | nome, valor, data, categoria, conta           | `updateTransaction` / `transactionSchema` |
| fixa          | nome, valor, dia de vencimento, categoria, conta | `updateFixedExpense` / `fixedExpenseEditSchema` |
| entrada       | origem, valor                                 | `updateIncome` / `incomeEditSchema`      |

> Notas de compatibilidade que o modo edit **deve** respeitar:
> - Entrada em edição **não** edita `referenceMonth` nem data (hoje só origem + valor).
> - Fixa em edição edita `dueDay` (não `date`) e **não** move `referenceMonth`.
> - Saída avulsa em edição edita `date`.
> - Nenhuma action ou schema muda; o modo edit apenas reusa os já existentes.

## Escopo

**Fase 1 (este projeto):**

- Modo `edit` unificado no `TransactionForm` cobrindo **saída avulsa, fixa e entrada**.
- Polish visual do formulário (criar + editar herdam).
- Repaginação da `SplitSection`.
- Preview contextual para todos os tipos na página `/registro`.
- Seletor de mês em pt-BR (substitui `<input type="month">` que exibe "July 2026").

**Fora de escopo (fase 2):**

- Edição de parcela (`InstallmentGroupEditDialog`), investimento e resgate — mantêm seus
  dialogs próprios por ora. O Segment de tipo em modo edit não oferece esses tipos.
- Edição de split em lançamento já criado.

## Arquitetura — `TransactionForm` ganha modo edit

Props novas, **todas aditivas** (defaults preservam o comportamento de criação atual byte
a byte):

```ts
type Mode = 'create' | 'edit'

type EditContext = {
  entityId: string
  // tipo travado — determina campos renderizados e action de submit
  primaryType: 'saida' | 'entrada'
  subType?: 'avulsa' | 'fixa'   // relevante só para saída
  initialValues: {
    name?: string          // saída
    source?: string        // entrada
    amount: string
    date?: string          // saída avulsa
    dueDay?: number        // fixa
    categoryId?: string
    accountId?: string
  }
}

type Props = {
  // ...props atuais inalteradas...
  mode?: Mode                    // default 'create'
  editContext?: EditContext      // obrigatório quando mode === 'edit'
}
```

**Comportamento em `mode="edit"`:**

- O `Segment` de tipo é substituído por um **cabeçalho de contexto read-only** (mesmo
  hero colorido do tipo, sem permitir troca — trocar tipo é outra entidade).
- Sem `SplitSection`, sem troca de subtipo, sem campo de parcelas.
- Campos renderizados conforme o mapa de compatibilidade acima.
- `useEffect` de `onFormChange` (preview) permanece opcional; em edit os wrappers não
  passam `onFormChange`.
- Submit roteia para a action correta e reusa o schema já existente daquele tipo.
- Botão: **"Salvar alterações"**.
- Estado inicial vem de `editContext.initialValues` (via `defaultValue` nos inputs e
  `useState` inicial nos selects controlados).

**Wrappers** (`TransactionEditButton`, `FixedExpenseEditButton`, `IncomeEditButton`)
mantêm exatamente sua API pública (`open` / `onOpenChange` + trigger `Pencil`). Só trocam
o **corpo**: o `EditForm` cru interno é removido e substituído por `<TransactionForm
mode="edit" editContext={...} onSuccess={...} />` dentro do mesmo `FormLoader` (que já
busca `getRegistrationFormData`). `IncomeEditButton` não precisa de form data (entrada não
tem categoria/conta) — passa listas vazias ou um caminho que não renderiza esses campos.

### Isolamento / responsabilidades

- `TransactionForm` continua sendo o orquestrador; ganha um branch de submit para edit
  que delega às três actions de update. A lógica de create permanece intocada.
- Os sub-componentes de campo (`HeroAmountCard`, `SaidaConditionalFields`,
  `EntradaFields`, `CategoryPicker`) são reusados; onde necessário aceitam
  `defaultValue`/`initialValue` para popular em edit.
- Nenhum sub-componente novo obrigatório além do **seletor de mês pt-BR** (ver abaixo).

## Polish visual (criar + editar herdam)

1. **Resgate ganha ícone** no `Segment` (hoje é o único tipo sem ícone).
2. **Chips de subtipo** (`HeroAmountCard`): remover os hacks de `opacity` e
   `hover:border-transparent`; padronizar estados via tokens do DS.
3. **Ritmo/densidade**: alinhar o `space-y` entre a página e o dialog para que o form
   tenha a mesma respiração nos dois contextos.
4. Editar passa a exibir hero colorido + `CategoryPicker` combobox + `Field`s
   consistentes — herança direta da unificação.

## Repaginação da `SplitSection`

Problema atual: o `Switch "Registrar só minha parte"` fica espremido entre o botão
"Adicionar pessoa" e o box de resumo, sem respiro nem explicação do que faz.

Refinos:

- **Respiro**: `Separator` (ou espaçamento do grid de 4px) antes do bloco de modo, para o
  switch não colar em "Adicionar pessoa".
- **Bloco coeso modo + resumo**: agrupar o toggle "Registrar só a minha parte" com o box
  "Sua parte / Valor a registrar" — eles são relacionados (o toggle muda o que o resumo
  significa). Incluir **hint de uma linha** explicando o efeito (ex.: "As partes das
  outras pessoas viram cobranças em Devedores").
- **Linhas de entrada**: revisar o alinhamento do `X` de remover (hack `mb-0.5`), larguras
  e labels só na primeira linha (mantém).
- Sem mudança de lógica de cálculo (`rebalance`, `computeEqualShare`, `yourShareCents`) —
  apenas apresentação.

## Preview contextual (`/registro`)

Hoje o painel só é útil para saída/entrada; fica vazio para investimento/resgate.

- **saída** → card do lançamento + impacto no orçamento da categoria + saldo após (já
  existe).
- **entrada** → card + saldo após.
- **investimento** → card + total aportado no tipo.
- **resgate** → card + saldo restante do tipo.
- **Estado vazio**: em vez de texto morto, exibir o **saldo atual do mês** como âncora.

Dados adicionais (saldo por tipo de investimento) vêm da `getRegistrationFormData` /
`RegistroPageClient` já disponível no server; estender o payload só se necessário, sem
queries `SUM` sobre colunas cifradas (agregar em JS conforme padrão de cripto).

## Seletor de mês pt-BR

`<input type="month">` exibe o mês no locale do browser ("July 2026") — verruga num app
pt-BR. Substituir por um seletor mês+ano em pt-BR usando os helpers de `lib/utils/date.ts`
(`<input type="date">` permanece nativo, aceitável). Aplicar onde o form usa
`referenceMonth` (entrada, fixa/criação, investimento). O componente segue o DS
(`Select`), populando `YYYY-MM` como o input nativo fazia, para não mexer na conversão
`+ '-01'` já existente nas actions.

## Backward-compat e verificação (restrição "nada quebra")

- Props de edit são **aditivas**; sem `mode`/`editContext`, o `TransactionForm` renderiza
  e submete exatamente como hoje.
- Wrappers de edição mantêm API pública (`open`/`onOpenChange`, trigger).
- Assinaturas de `updateTransaction`/`updateFixedExpense`/`updateIncome` e os schemas
  (`transactionSchema`, `fixedExpenseEditSchema`, `incomeEditSchema`) **não mudam**.
- Verificação obrigatória antes de concluir:
  - `npm run lint && npm run format:check && npm run typecheck && npm test`
  - Passe manual via Playwright:
    - Criar: saída avulsa/fixa/parcelada, entrada, investimento, resgate (todos salvam).
    - Editar: saída avulsa, fixa, entrada (campos corretos por tipo, salva e revalida).
    - Split: abrir, adicionar/remover pessoa, "registrar só minha parte", salvar.
    - Preview: os quatro tipos + estado vazio.
    - Desktop e mobile (dialog vs drawer).

## Critérios de sucesso

- Editar saída avulsa/fixa/entrada tem o mesmo visual do criar (hero colorido,
  CategoryPicker, Fields consistentes).
- `SplitSection` com switch respirando e efeito explicado.
- Preview útil nos quatro tipos; estado vazio com saldo do mês.
- Mês exibido em pt-BR.
- Toda a suíte (lint/format/typecheck/test) verde; nenhum fluxo existente quebrado.
