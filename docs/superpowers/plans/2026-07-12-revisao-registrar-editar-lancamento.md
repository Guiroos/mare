# Revisão de Registrar / Editar Lançamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar criar/editar lançamento no `TransactionForm`, com polish visual, `SplitSection` repaginada, preview contextual e seletor de mês em pt-BR — sem quebrar nenhum fluxo existente.

**Architecture:** O `TransactionForm` ganha props aditivas `mode`/`editContext`; em modo edit trava o tipo, renderiza os campos corretos por tipo e roteia o submit para as actions de update já existentes. Os três wrappers de edição (`TransactionEditButton`, `FixedExpenseEditButton`, `IncomeEditButton`) passam a renderizar o `TransactionForm` em vez de forms crus, mantendo sua API pública. Melhorias visuais e de preview são incrementais sobre os componentes atuais.

**Tech Stack:** Next.js 14 (App Router), React, TypeScript, Tailwind (DS Maré), Zod, Drizzle, Vitest, Playwright MCP.

## Global Constraints

- Comunicação/código em pt-BR; identificadores e commits em inglês (Conventional Commits).
- Nunca `--no-verify`. Antes de finalizar: `npm run lint && npm run format:check && npm run typecheck && npm test`.
- Zero valores arbitrários Tailwind fora dos tokens do DS; formulários usam `<Field>`; um componente por arquivo; compostos usam primitivos (ver `.claude/ds-components.md`).
- Ao adicionar componente em `components/ui/`, atualizar **apenas** `.claude/ds-components.md` e rodar o agente `ds-reviewer` ao final.
- Props novas do `TransactionForm` são **aditivas**: sem `mode`/`editContext` o comportamento de criação é idêntico ao atual.
- Assinaturas de `updateTransaction`/`updateFixedExpense`/`updateIncome` e os schemas `transactionSchema`/`fixedExpenseEditSchema`/`incomeEditSchema` **não mudam**.
- Radix `<Select>` não popula `FormData` — componentes baseados em Select que precisam ir no `FormData` mantêm `<input type="hidden">` espelhando o valor.
- Datas: mês em URLs/inputs é `YYYY-MM`; converter para `YYYY-MM-01` só na action (padrão já existente).
- Hook `PostToolUse` bloqueia edits com imports não usados e dispara `ds-reviewer` em Write/Edit de componentes — ao fazer várias mudanças num arquivo de componente, preferir um único `Write` do arquivo inteiro.

---

## File Structure

**Criar:**
- `components/ui/month-select.tsx` — seletor de mês pt-BR (Select + hidden input), reusável.

**Modificar:**
- `lib/utils/date.ts` — helper puro `monthOptions(center, back, forward)`.
- `components/forms/transaction/EntradaFields.tsx` — usa `MonthSelect`.
- `components/forms/transaction/InvestimentoFields.tsx` — usa `MonthSelect`.
- `components/forms/transaction/SaidaConditionalFields.tsx` — usa `MonthSelect` no campo de mês.
- `components/forms/transaction/HeroAmountCard.tsx` — `defaultAmount`, `lockSubType`, limpeza dos chips, cor.
- `components/forms/transaction/types.ts` — tipos `Mode`/`EditContext`.
- `components/forms/TransactionForm.tsx` — props `mode`/`editContext`, header travado, roteamento de submit, ícone de resgate.
- `components/forms/transaction/SplitSection.tsx` — repaginação (respiro, bloco modo+resumo, hint).
- `components/dashboard/TransactionEditDialog.tsx` — corpo vira `TransactionForm mode="edit"`.
- `components/dashboard/FixedExpenseEditDialog.tsx` — idem.
- `components/dashboard/IncomeEditDialog.tsx` — idem.
- `lib/actions/form-data.ts` — inclui `investmentBalances` no payload.
- `app/(app)/registro/RegistroPageClient.tsx` — preview contextual + estado vazio com saldo.
- `.claude/ds-components.md` — inventário do `MonthSelect`.

**Testar:**
- `__tests__/unit/utils/date.test.ts` (ou arquivo existente de date) — `monthOptions`.
- Verificação de UI via Playwright MCP (o projeto não tem unit tests de componentes React).

---

## Task 1: `MonthSelect` (seletor de mês pt-BR)

**Files:**
- Create: `components/ui/month-select.tsx`
- Modify: `lib/utils/date.ts`
- Modify: `components/forms/transaction/EntradaFields.tsx`
- Modify: `components/forms/transaction/InvestimentoFields.tsx`
- Modify: `components/forms/transaction/SaidaConditionalFields.tsx`
- Modify: `.claude/ds-components.md`
- Test: `__tests__/unit/utils/date.test.ts`

**Interfaces:**
- Consumes: `formatMonthYear(yearMonth)`, `currentYearMonth()` de `lib/utils/date`.
- Produces:
  - `monthOptions(centerYearMonth: string, back: number, forward: number): string[]` — lista `YYYY-MM`, mais antigo primeiro, incluindo o centro.
  - `<MonthSelect name: string; defaultValue?: string; error?: boolean; back?: number; forward?: number />` — renderiza `Select` de meses pt-BR + `<input type="hidden" name={name}>` com `YYYY-MM`.

- [ ] **Step 1: Escrever teste de `monthOptions`**

Adicionar em `__tests__/unit/utils/date.test.ts` (verificar antes se o arquivo existe com `ls __tests__/unit/utils/`; se não existir, criar com o import padrão do módulo):

```ts
import { monthOptions } from '@/lib/utils/date'

describe('monthOptions', () => {
  it('inclui o centro e respeita back/forward em ordem crescente', () => {
    expect(monthOptions('2025-06', 2, 2)).toEqual([
      '2025-04',
      '2025-05',
      '2025-06',
      '2025-07',
      '2025-08',
    ])
  })

  it('atravessa fronteira de ano corretamente', () => {
    expect(monthOptions('2025-01', 1, 1)).toEqual(['2024-12', '2025-01', '2025-02'])
  })

  it('back=0 e forward=0 retorna só o centro', () => {
    expect(monthOptions('2025-06', 0, 0)).toEqual(['2025-06'])
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- date`
Expected: FAIL com "monthOptions is not a function" / não exportado.

- [ ] **Step 3: Implementar `monthOptions` em `lib/utils/date.ts`**

Adicionar após `formatMonthYear` (usa `addMonths`/`subMonths`/`parseISO`/`format` já importados):

```ts
/** Retorna uma lista de YYYY-MM centrada em centerYearMonth, com `back` meses antes e `forward` depois (crescente). */
export function monthOptions(centerYearMonth: string, back: number, forward: number): string[] {
  const center = parseISO(`${centerYearMonth}-01`)
  const result: string[] = []
  for (let i = back; i >= 1; i--) result.push(format(subMonths(center, i), 'yyyy-MM'))
  result.push(format(center, 'yyyy-MM'))
  for (let i = 1; i <= forward; i++) result.push(format(addMonths(center, i), 'yyyy-MM'))
  return result
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm test -- date`
Expected: PASS.

- [ ] **Step 5: Criar `components/ui/month-select.tsx`**

```tsx
'use client'

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { currentYearMonth, formatMonthYear, monthOptions } from '@/lib/utils/date'

type Props = {
  name: string
  defaultValue?: string
  error?: boolean
  back?: number
  forward?: number
}

export function MonthSelect({ name, defaultValue, error, back = 12, forward = 12 }: Props) {
  const initial = defaultValue ?? currentYearMonth()
  const [value, setValue] = useState(initial)
  const options = monthOptions(initial, back, forward)
  // garante que o valor atual esteja nas opções mesmo se fora da janela
  const allOptions = options.includes(value) ? options : [value, ...options]

  return (
    <>
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger error={error} className="bg-bg-input">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allOptions.map((ym) => (
            <SelectItem key={ym} value={ym}>
              {formatMonthYear(ym)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name={name} value={value} />
    </>
  )
}
```

- [ ] **Step 6: Trocar `<input type="month">` em `EntradaFields.tsx`**

Reescrever o arquivo inteiro (Write) para usar `MonthSelect`:

```tsx
import { Field } from '@/components/ui/field'
import { MonthSelect } from '@/components/ui/month-select'

type Props = {
  errors: Record<string, string>
  month: string
}

export function EntradaFields({ errors, month }: Props) {
  return (
    <Field label="Mês de referência" error={errors.referenceMonth}>
      <MonthSelect name="referenceMonth" defaultValue={month} error={!!errors.referenceMonth} />
    </Field>
  )
}
```

- [ ] **Step 7: Trocar `<input type="month">` em `InvestimentoFields.tsx`**

Reescrever o arquivo inteiro (Write), preservando `notes` e o `Switch`:

```tsx
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { MonthSelect } from '@/components/ui/month-select'

type Props = {
  errors: Record<string, string>
  month: string
  excludeFromCashFlow: boolean
  onExcludeChange: (v: boolean) => void
}

export function InvestimentoFields({ errors, month, excludeFromCashFlow, onExcludeChange }: Props) {
  return (
    <>
      <Field label="Mês de referência" error={errors.referenceMonth}>
        <MonthSelect name="referenceMonth" defaultValue={month} error={!!errors.referenceMonth} />
      </Field>
      <Field label="Observações">
        <Input name="notes" placeholder="Opcional" />
      </Field>
      <Switch
        label="Excluir do fluxo de caixa"
        checked={excludeFromCashFlow}
        onChange={onExcludeChange}
      />
    </>
  )
}
```

- [ ] **Step 8: Trocar o campo de mês (fixo) em `SaidaConditionalFields.tsx`**

No branch `resolvedType === 'fixo'`, substituir o `<Field label="Mês de referência">` que contém `<Input name="referenceMonth" type="month" ...>` por:

```tsx
<Field label="Mês de referência" error={errors.referenceMonth}>
  <MonthSelect name="referenceMonth" defaultValue={month} error={!!errors.referenceMonth} />
</Field>
```

E adicionar o import no topo: `import { MonthSelect } from '@/components/ui/month-select'`. (Reescrever o arquivo inteiro via Write para evitar o hook de imports.)

- [ ] **Step 9: Atualizar `.claude/ds-components.md`**

Na tabela de inventário, adicionar linha após `numeric-input.tsx`:

```
| `month-select.tsx`   | `MonthSelect`                   | Select de mês em pt-BR (`formatMonthYear`); popula `FormData` via hidden input com `YYYY-MM`; props `name` `defaultValue` `error` `back` `forward` |
```

E na Camada 2 (Compostos), acrescentar `MonthSelect` à lista de compostos que usam `Select`.

- [ ] **Step 10: Verificar (typecheck + lint + Playwright)**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

Playwright: `browser_navigate http://localhost:3000/registro` → clicar "Entrada" → o campo "Mês de referência" mostra "Julho 2026" (pt-BR), abre o Select, seleciona outro mês, salva a entrada com sucesso. Repetir clicando "Investimento" e "Saída → Fixa".

- [ ] **Step 11: Commit**

```bash
git add components/ui/month-select.tsx lib/utils/date.ts __tests__/unit/utils/date.test.ts components/forms/transaction/EntradaFields.tsx components/forms/transaction/InvestimentoFields.tsx components/forms/transaction/SaidaConditionalFields.tsx .claude/ds-components.md
git commit -m "feat(registro): seletor de mês em pt-BR (MonthSelect)"
```

---

## Task 2: `HeroAmountCard` — `defaultAmount`, `lockSubType`, limpeza dos chips

**Files:**
- Modify: `components/forms/transaction/HeroAmountCard.tsx`

**Interfaces:**
- Consumes: `NumericInput` (já aceita `defaultValue`).
- Produces: `HeroAmountCard` ganha props opcionais `defaultAmount?: string`, `defaultYield?: string`, `lockSubType?: boolean` (quando `true`, não renderiza os chips de subtipo). Comportamento atual preservado quando as props são omitidas.

- [ ] **Step 1: Reescrever `HeroAmountCard.tsx` (Write) com as props novas e chips limpos**

Mudanças: (a) `defaultAmount`/`defaultYield` passados como `defaultValue` aos `NumericInput`; (b) `lockSubType` esconde os chips; (c) remover os hacks `hover:border-transparent hover:opacity-100` dos chips inativos, mantendo estados via tokens.

```tsx
import { NumericInput } from '@/components/ui/numeric-input'
import { Chip } from '@/components/ui/chip'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils/cn'
import type { FormType, PrimaryType, SaidaSubType } from './types'

const SAIDA_SUBTYPES: { value: SaidaSubType; label: string }[] = [
  { value: 'avulsa', label: 'Avulsa' },
  { value: 'fixa', label: 'Fixa' },
  { value: 'parcelada', label: 'Parcelada' },
]

const heroCard: Record<PrimaryType, string> = {
  saida: 'bg-negative-subtle',
  entrada: 'bg-positive-subtle',
  investimento: 'bg-accent-subtle',
  resgate: 'bg-positive-subtle',
}

const heroLabel: Record<PrimaryType, string> = {
  saida: 'text-negative-text',
  entrada: 'text-positive-text',
  investimento: 'text-accent-text',
  resgate: 'text-positive-text',
}

const heroInput: Record<PrimaryType, string> = {
  saida: 'text-negative-text placeholder:text-negative-text placeholder:opacity-50',
  entrada: 'text-positive-text placeholder:text-positive-text placeholder:opacity-50',
  investimento: 'text-accent-text placeholder:text-accent-text placeholder:opacity-50',
  resgate: 'text-positive-text placeholder:text-positive-text placeholder:opacity-50',
}

const primaryTypeLabel: Record<PrimaryType, string> = {
  saida: 'Saída',
  entrada: 'Entrada',
  investimento: 'Investimento',
  resgate: 'Resgate',
}

type Props = {
  primaryType: PrimaryType
  resolvedType: FormType
  subType: SaidaSubType
  onSubTypeChange: (v: SaidaSubType) => void
  onValueChange: (cents: number) => void
  errors: Record<string, string>
  defaultAmount?: string
  defaultYield?: string
  lockSubType?: boolean
}

export function HeroAmountCard({
  primaryType,
  resolvedType,
  subType,
  onSubTypeChange,
  onValueChange,
  errors,
  defaultAmount,
  defaultYield,
  lockSubType = false,
}: Props) {
  if (primaryType === 'investimento') {
    return (
      <div className={cn('rounded-lg p-4', heroCard.investimento)}>
        <p
          className={cn(
            'text-label font-semibold uppercase tracking-widest',
            heroLabel.investimento
          )}
        >
          Investimento
        </p>
        <div className="mt-1">
          <p className={cn('text-caption opacity-60', heroLabel.investimento)}>Aporte</p>
          <div className="flex items-baseline gap-2">
            <span className={cn('text-h3', heroLabel.investimento)}>R$</span>
            <NumericInput
              name="amount"
              defaultValue={defaultAmount}
              error={!!errors.amount}
              autoFocus
              onValueChange={onValueChange}
              preserveExplicitZero
              className={cn(
                'h-auto border-0 bg-transparent py-1 text-display tabular-nums shadow-none focus:border-transparent focus:shadow-none',
                heroLabel.investimento
              )}
            />
          </div>
        </div>
        <Separator className="my-3" />
        <div>
          <p className={cn('text-caption opacity-60', heroLabel.investimento)}>
            Rendimento líquido
          </p>
          <div className="flex items-baseline gap-2">
            <span className={cn('text-body opacity-70', heroLabel.investimento)}>R$</span>
            <NumericInput
              name="yieldAmount"
              defaultValue={defaultYield}
              error={!!errors.yieldAmount}
              preserveExplicitZero
              className={cn(
                'h-auto border-0 bg-transparent py-1 text-h2 tabular-nums shadow-none focus:border-transparent focus:shadow-none',
                heroLabel.investimento
              )}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-1 rounded-lg p-4', heroCard[primaryType])}>
      <p
        className={cn('text-label font-semibold uppercase tracking-widest', heroLabel[primaryType])}
      >
        {primaryTypeLabel[primaryType]}
      </p>
      <div className="flex items-baseline gap-2">
        <span className={cn('text-h3', heroLabel[primaryType])}>R$</span>
        <NumericInput
          name={resolvedType === 'parcelado' ? 'totalAmount' : 'amount'}
          defaultValue={defaultAmount}
          error={!!(errors.amount ?? errors.totalAmount)}
          required
          autoFocus
          onValueChange={onValueChange}
          className={cn(
            'h-auto border-0 bg-transparent py-1 text-display tabular-nums shadow-none focus:border-transparent focus:shadow-none',
            heroInput[primaryType]
          )}
        />
      </div>
      {primaryType === 'saida' && !lockSubType && (
        <div className="flex gap-1 pt-1">
          {SAIDA_SUBTYPES.map((st) => (
            <Chip
              key={st.value}
              active={subType === st.value}
              onClick={() => onSubTypeChange(st.value)}
              className={cn(
                'px-2 py-0.5 text-caption',
                subType === st.value
                  ? 'border-negative bg-bg-surface text-negative-text'
                  : 'border-transparent bg-transparent text-negative-text opacity-60'
              )}
            >
              {st.label}
            </Chip>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar (typecheck + Playwright)**

Run: `npm run typecheck`
Expected: sem erros.

Playwright: em `/registro` → "Saída" ainda mostra os chips Avulsa/Fixa/Parcelada e o valor digitável. Sem regressão visual.

- [ ] **Step 3: Commit**

```bash
git add components/forms/transaction/HeroAmountCard.tsx
git commit -m "feat(registro): HeroAmountCard aceita valor inicial e trava de subtipo"
```

---

## Task 3: `TransactionForm` — modo edit (props `mode`/`editContext`)

**Files:**
- Modify: `components/forms/transaction/types.ts`
- Modify: `components/forms/TransactionForm.tsx`

**Interfaces:**
- Consumes: `HeroAmountCard` (props `defaultAmount`/`lockSubType` da Task 2), `CategoryPicker`, `updateTransaction`, `updateFixedExpense` de `@/lib/actions/transactions`, `updateIncome` de `@/lib/actions/incomes`, schemas `transactionSchema`/`fixedExpenseEditSchema`/`incomeEditSchema`.
- Produces:
  - Em `types.ts`:
    ```ts
    export type EditContext = {
      entityId: string
      primaryType: 'saida' | 'entrada'
      subType?: 'avulsa' | 'fixa'
      initialValues: {
        name?: string
        source?: string
        amount: string
        date?: string
        dueDay?: number
        categoryId?: string
        accountId?: string
      }
    }
    ```
  - `TransactionForm` ganha props `mode?: 'create' | 'edit'` (default `'create'`) e `editContext?: EditContext`.

- [ ] **Step 1: Adicionar `EditContext` em `components/forms/transaction/types.ts`**

Ler o arquivo atual e acrescentar (Write do arquivo inteiro) o tipo `EditContext` acima, mantendo os tipos existentes (`PrimaryType`, `SaidaSubType`, `FormType`, `PreviewState`, `Account`, `CategoryGroup`, `InvestmentType`).

- [ ] **Step 2: Reescrever `TransactionForm.tsx` (Write) com modo edit**

Pontos-chave (o restante do arquivo permanece igual ao atual):

1. Import das actions de update e do tipo `EditContext`:
   ```ts
   import { updateTransaction, updateFixedExpense, ... } from '@/lib/actions/transactions'
   import { createIncome, updateIncome } from '@/lib/actions/incomes'
   import { fixedExpenseEditSchema, incomeEditSchema, ... } from '@/lib/validations/transactions'
   import type { ..., EditContext } from './transaction/types'
   ```
   Adicionar ícone `TrendingDown` ao import de `lucide-react` (para o resgate).

2. Props:
   ```ts
   mode?: 'create' | 'edit'
   editContext?: EditContext
   ```
   Desestruturar com `mode = 'create'`.

3. `const isEdit = mode === 'edit'`. Inicializar estado a partir de `editContext`:
   ```ts
   const [primaryType, setPrimaryType] = useState<PrimaryType>(editContext?.primaryType ?? 'saida')
   const [subType, setSubType] = useState<SaidaSubType>(editContext?.subType ?? 'avulsa')
   const [categoryId, setCategoryId] = useState(editContext?.initialValues.categoryId ?? '')
   const [accountId, setAccountId] = useState(editContext?.initialValues.accountId ?? '')
   const [previewName, setPreviewName] = useState(
     editContext?.initialValues.name ?? editContext?.initialValues.source ?? ''
   )
   ```
   Os demais estados (installments, isPaid, splits...) permanecem com os defaults atuais.

4. `resolvedFormType()`: em edit, o subtipo `'parcelada'` nunca ocorre (não editável nesta fase), então a função atual já funciona (`subType` é `'avulsa'` ou `'fixa'`).

5. Header: quando `isEdit`, renderizar um cabeçalho de contexto read-only no lugar do `<Segment>`:
   ```tsx
   {isEdit ? (
     <div className={cn('rounded-md px-3 py-2 text-caption font-semibold', typeSegActiveText[primaryType])}>
       {`Editando ${primaryTypeContextLabel[primaryType]}`}
     </div>
   ) : (
     <div className="overflow-x-auto">
       <Segment ... />  {/* inalterado */}
     </div>
   )}
   ```
   Definir no topo:
   ```ts
   const primaryTypeContextLabel: Record<PrimaryType, string> = {
     saida: 'saída',
     entrada: 'entrada',
     investimento: 'investimento',
     resgate: 'resgate',
   }
   ```

6. `HeroAmountCard`: passar `defaultAmount={editContext?.initialValues.amount}` e `lockSubType={isEdit}`.

7. Campos condicionais em edit: manter os mesmos componentes, mas populando defaults. Para saída, o `SaidaConditionalFields` já usa `defaultValue={today}` na data — em edit precisamos da data da transação. Passar uma prop nova `defaultDate` (data) e `defaultDueDay` para o `SaidaConditionalFields` (ver Step 3). Para `Input` de nome/origem, usar `defaultValue`:
   ```tsx
   <Input
     name={primaryType === 'entrada' ? 'source' : 'name'}
     defaultValue={editContext?.initialValues.name ?? editContext?.initialValues.source}
     ...
   />
   ```

8. Em edit, **esconder** o `CategoryPicker` para entrada (já é o caso, só saída renderiza) e esconder `SplitSection` (`{!isEdit && primaryType === 'saida' && ...}`).

9. Submit: novo branch no início do `handleSubmit`:
   ```ts
   if (isEdit && editContext) {
     if (editContext.primaryType === 'entrada') {
       const result = incomeEditSchema.safeParse({ source: str('source'), amount: str('amount') })
       if (!result.success) { setErrors(formatZodErrors(result.error)); return }
       setErrors({})
       startTransition(async () => {
         try {
           await updateIncome({ id: editContext.entityId, ...result.data })
           onSuccess?.()
         } catch { toast.error('Erro ao salvar. Tente novamente.') }
       })
       return
     }
     if (editContext.subType === 'fixa') {
       const result = fixedExpenseEditSchema.safeParse({
         name: str('name'), amount: str('amount'), dueDay: str('dueDay'),
         categoryId, accountId,
       })
       if (!result.success) { setErrors(formatZodErrors(result.error)); return }
       setErrors({})
       startTransition(async () => {
         try {
           await updateFixedExpense({
             id: editContext.entityId,
             name: result.data.name, amount: result.data.amount,
             dueDay: Number(result.data.dueDay),
             categoryId: result.data.categoryId, accountId: result.data.accountId,
           })
           onSuccess?.()
         } catch { toast.error('Erro ao salvar. Tente novamente.') }
       })
       return
     }
     // saída avulsa
     const result = transactionSchema.safeParse({
       name: str('name'), amount: str('amount'), date: str('date'), categoryId, accountId,
     })
     if (!result.success) { setErrors(formatZodErrors(result.error)); return }
     setErrors({})
     startTransition(async () => {
       try {
         await updateTransaction({ id: editContext.entityId, ...result.data })
         onSuccess?.()
       } catch { toast.error('Erro ao salvar. Tente novamente.') }
     })
     return
   }
   ```
   O restante do `handleSubmit` (create) permanece intocado.

10. Botão de submit:
    ```tsx
    <Button type="submit" className="w-full" loading={isPending}>
      {isEdit ? 'Salvar alterações' : submitLabel[primaryType]}
    </Button>
    ```

11. `resetForm` **não** deve rodar em edit no sucesso (o dialog fecha). Manter `resetForm()` apenas nos branches de create.

- [ ] **Step 3: Passar defaults de data/dia ao `SaidaConditionalFields`**

Reescrever `SaidaConditionalFields.tsx` (Write) adicionando props opcionais `defaultDate?: string` e `defaultDueDay?: number`, usadas nos `defaultValue`:
```tsx
// avulso:
<Input name="date" type="date" defaultValue={defaultDate ?? today} ... />
// fixo:
<Input name="dueDay" type="number" min="1" max="31" defaultValue={defaultDueDay} ... />
```
Adicionar as duas props ao `type Props` e à desestruturação. No `TransactionForm`, passar `defaultDate={editContext?.initialValues.date}` e `defaultDueDay={editContext?.initialValues.dueDay}`.

- [ ] **Step 4: Verificar (typecheck + lint)**

Run: `npm run typecheck && npm run lint`
Expected: sem erros. (Ainda sem UI de edit ligada — só a base do form.)

- [ ] **Step 5: Commit**

```bash
git add components/forms/TransactionForm.tsx components/forms/transaction/types.ts components/forms/transaction/SaidaConditionalFields.tsx
git commit -m "feat(registro): TransactionForm ganha modo edit (tipo travado + roteamento de update)"
```

---

## Task 4: Religar os wrappers de edição ao `TransactionForm`

**Files:**
- Modify: `components/dashboard/TransactionEditDialog.tsx`
- Modify: `components/dashboard/FixedExpenseEditDialog.tsx`
- Modify: `components/dashboard/IncomeEditDialog.tsx`

**Interfaces:**
- Consumes: `TransactionForm` com `mode="edit"` e `editContext` (Task 3); `getRegistrationFormData`.
- Produces: wrappers com API pública inalterada (`open`/`onOpenChange`, trigger `Pencil`).

- [ ] **Step 1: Reescrever `TransactionEditDialog.tsx` (Write)**

Substituir o `EditForm` interno pelo `TransactionForm`. O `FormLoader` continua buscando `getRegistrationFormData`. Corpo novo do `FormLoader`:

```tsx
return (
  <TransactionForm
    mode="edit"
    categoryGroups={formData.categoryGroups}
    accounts={formData.accounts}
    editContext={{
      entityId: transaction.id,
      primaryType: 'saida',
      subType: 'avulsa',
      initialValues: {
        name: transaction.name,
        amount: transaction.amount,
        date: transaction.date,
        categoryId: transaction.categoryId ?? undefined,
        accountId: transaction.accountId ?? undefined,
      },
    }}
    onSuccess={onSuccess}
  />
)
```
Remover o componente `EditForm` e imports agora não usados (`Field`, `Input`, `CurrencyInput`, `Select*`, `transactionSchema`, `formatZodErrors`, `updateTransaction`, `useState`/`useTransition`/`FormEvent` se não usados). Manter `Dialog`/`Drawer`/`Button`/`Pencil`/`useMediaQuery`/`getRegistrationFormData`/`TransactionForm`. Título do dialog permanece "Editar transação".

- [ ] **Step 2: Reescrever `FixedExpenseEditDialog.tsx` (Write)**

`FormLoader` novo:
```tsx
return (
  <TransactionForm
    mode="edit"
    categoryGroups={formData.categoryGroups}
    accounts={formData.accounts}
    editContext={{
      entityId: expense.id,
      primaryType: 'saida',
      subType: 'fixa',
      initialValues: {
        name: expense.name,
        amount: expense.amount,
        dueDay: expense.dueDay,
        categoryId: expense.categoryId ?? undefined,
        accountId: expense.accountId ?? undefined,
      },
    }}
    onSuccess={onSuccess}
  />
)
```
Remover `EditForm` e imports órfãos. Título "Editar gasto fixo".

- [ ] **Step 3: Reescrever `IncomeEditDialog.tsx` (Write)**

Entrada não tem categoria/conta, então passa listas vazias:
```tsx
const content = (
  <TransactionForm
    mode="edit"
    categoryGroups={[]}
    accounts={[]}
    editContext={{
      entityId: income.id,
      primaryType: 'entrada',
      initialValues: { source: income.source, amount: income.amount },
    }}
    onSuccess={() => setOpen(false)}
  />
)
```
Remover `EditForm`, `incomeEditSchema`, `updateIncome`, `Field`, `Input`, `CurrencyInput`, `formatZodErrors`, `useTransition`/`useState`/`FormEvent` órfãos. Título "Editar entrada".

- [ ] **Step 4: Verificar (typecheck + lint + Playwright)**

Run: `npm run typecheck && npm run lint`
Expected: sem erros (nenhum import órfão — o hook bloqueia se houver).

Playwright (desktop e mobile):
- Dashboard → transação avulsa → kebab "Editar": abre com hero vermelho, nome/valor/data/categoria(combobox)/conta preenchidos; alterar valor → "Salvar alterações" → lista atualiza.
- Gasto fixo → "Editar": hero vermelho, nome/valor/dia de vencimento/categoria/conta; salva.
- Entrada → "Editar": hero verde, origem + valor apenas (sem categoria/conta/mês); salva.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/TransactionEditDialog.tsx components/dashboard/FixedExpenseEditDialog.tsx components/dashboard/IncomeEditDialog.tsx
git commit -m "refactor(registro): edição usa TransactionForm unificado (saída/fixa/entrada)"
```

---

## Task 5: Polish do `Segment` de tipo (ícone do Resgate)

**Files:**
- Modify: `components/forms/TransactionForm.tsx`

**Interfaces:**
- Consumes: `TrendingDown` de `lucide-react`.
- Produces: `PRIMARY_TYPES` com ícone para `resgate`.

- [ ] **Step 1: Adicionar ícone ao resgate**

Em `TransactionForm.tsx`, no array `PRIMARY_TYPES`, trocar a entrada do resgate:
```ts
{ value: 'resgate', label: 'Resgate', icon: TrendingDown },
```
Garantir o import `TrendingDown` (já adicionado na Task 3 se aplicável; senão adicionar). Os demais tipos permanecem.

- [ ] **Step 2: Verificar (typecheck + Playwright)**

Run: `npm run typecheck`
Expected: sem erros.
Playwright: `/registro` → os quatro tabs têm ícone; "Resgate" mostra o ícone de tendência de baixa.

- [ ] **Step 3: Commit**

```bash
git add components/forms/TransactionForm.tsx
git commit -m "feat(registro): ícone no tab Resgate (consistência do Segment)"
```

---

## Task 6: Repaginação da `SplitSection`

**Files:**
- Modify: `components/forms/transaction/SplitSection.tsx`

**Interfaces:**
- Consumes: `Separator`, `Switch`, `Button`, `Combobox`, `CurrencyInput`, `Field` (todos já importados/DS).
- Produces: mesma API pública (`people`, `totalCents`, `onChange`, `onIntegralChange`) e mesma lógica de cálculo — só apresentação.

- [ ] **Step 1: Reescrever o bloco aberto da `SplitSection` (Write do arquivo)**

Manter toda a lógica (`useEffect`, `addPerson`, `removePerson`, `rebalance`, `computeEqualShare`, `yourShareCents`) idêntica. Alterar apenas o JSX do estado aberto: (a) `Separator` antes do bloco de modo; (b) agrupar o `Switch` "Registrar só a minha parte" com o box de resumo num único bloco com hint. Substituir o trecho a partir do `Switch` até o final do resumo por:

```tsx
      {entries.length < people.length && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addPerson}
          className="gap-1.5 px-0 text-text-secondary hover:text-text-primary"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar pessoa
        </Button>
      )}

      <Separator />

      <div className="space-y-2">
        <Switch
          label="Registrar só a minha parte"
          checked={integral}
          onChange={handleIntegralChange}
        />
        <p className="text-caption text-text-tertiary">
          As partes das outras pessoas viram cobranças em Devedores.
        </p>
        <div className="flex items-center justify-between rounded-md bg-bg-surface px-3 py-2">
          <span className="text-small text-text-secondary">
            {integral ? 'Valor a registrar' : 'Sua parte'}
          </span>
          <span
            className={cn(
              'text-small font-semibold tabular-nums',
              yourShareCents < 0
                ? 'text-negative'
                : integral
                  ? 'text-accent-text'
                  : 'text-text-primary'
            )}
          >
            {formatCurrency(yourShareCents / 100)}
          </span>
        </div>
      </div>
```

Garantir o import de `Separator`: `import { Separator } from '@/components/ui/separator'`.

- [ ] **Step 2: Verificar (typecheck + Playwright)**

Run: `npm run typecheck`
Expected: sem erros.
Playwright: `/registro` → "Saída", digitar valor → "Dividir com alguém" → adicionar pessoa, alternar "Registrar só a minha parte" (resumo muda de "Sua parte" para "Valor a registrar"), hint visível, switch com respiro. Salvar com split funciona.

- [ ] **Step 3: Commit**

```bash
git add components/forms/transaction/SplitSection.tsx
git commit -m "feat(registro): repagina SplitSection (respiro do toggle + hint de cobrança)"
```

---

## Task 7: Preview contextual na página `/registro`

**Files:**
- Modify: `lib/actions/form-data.ts`
- Modify: `app/(app)/registro/RegistroPageClient.tsx`

**Interfaces:**
- Consumes: `getInvestmentBalances` de `@/lib/queries/investments`.
- Produces:
  - `getRegistrationFormData` retorna, além do atual, `investmentBalances: Record<string, number>` (id do tipo → `currentBalance`).
  - `RegistroPreviewPanel` passa a renderizar bloco contextual para `investimento`/`resgate` e um estado vazio com o saldo do mês.

- [ ] **Step 1: Estender `getRegistrationFormData`**

Em `lib/actions/form-data.ts`, adicionar `getInvestmentBalances` ao `Promise.all` e montar o mapa:
```ts
import { getInvestmentBalances } from '@/lib/queries/investments'
// ...dentro do Promise.all, adicionar:
getInvestmentBalances(userId),
// ...após o destructuring incluir `balances` como último elemento
const investmentBalances = Object.fromEntries(balances.map((b) => [b.id, b.currentBalance]))
// incluir no return:
return { categoryGroups, accounts, investmentTypes, categorySpends, currentBalance, people, investmentBalances }
```
Ajustar o array de destructuring do `Promise.all` para incluir a nova posição.

> Nota: `RegistrationDialogProvider` e os wrappers de edição consomem `getRegistrationFormData` mas ignoram `investmentBalances` (campo extra é inofensivo) — verificar que os tipos locais desses componentes não fazem destructuring estrito que quebre. Se algum tipo local declarar o shape exato, ele só lê os campos que usa; campo adicional no retorno não quebra.

- [ ] **Step 2: Adicionar preview contextual em `RegistroPageClient.tsx`**

Passar `investmentBalances` do `formData` para o `RegistroPreviewPanel` e adicionar, no painel: (a) estado vazio mostrando `formatCurrency(currentBalance)` como "Saldo do mês"; (b) para `investimento`, um card "Novo total aportado" = `(investmentBalances[investmentTypeId] ?? 0) + amountNum`; (c) para `resgate`, "Saldo restante" = `(investmentBalances[investmentTypeId] ?? 0) - amountNum`.

Como o `PreviewState` atual não carrega `investmentTypeId`, estendê-lo: adicionar `investmentTypeId?: string` e `investmentTypeName?: string` em `PreviewState` (`types.ts`) e preenchê-los no `useEffect` de `onFormChange` do `TransactionForm` (já tem `investmentTypeId` em estado). Atualizar o objeto emitido:
```ts
onFormChange({
  ...,
  investmentTypeId,
  investmentTypeName: investmentTypes.find((t) => t.id === investmentTypeId)?.name ?? '',
})
```
Adicionar `investmentTypes` às deps do `useEffect`.

Estado vazio novo:
```tsx
if (!state || (!state.name && !state.amount)) {
  return (
    <Card padding="md">
      <p className="text-caption font-semibold uppercase text-text-tertiary">Saldo do mês</p>
      <p className="mt-1 text-h1 font-semibold tabular-nums text-text-primary">
        {formatCurrency(currentBalance)}
      </p>
      <p className="mt-2 text-small text-text-tertiary">
        Preencha o formulário para visualizar o lançamento
      </p>
    </Card>
  )
}
```

Bloco investimento/resgate (adicionar após o card de transação, condicionado ao tipo):
```tsx
{(state.primaryType === 'investimento' || state.primaryType === 'resgate') &&
  state.investmentTypeId &&
  amountNum > 0 && (
    <Card padding="md">
      <p className="mb-1 text-caption font-semibold uppercase text-text-tertiary">
        {state.primaryType === 'investimento' ? 'Novo total aportado' : 'Saldo restante'}
      </p>
      <p className="text-h1 font-semibold tabular-nums text-text-primary">
        {formatCurrency(
          state.primaryType === 'investimento'
            ? (investmentBalances[state.investmentTypeId] ?? 0) + amountNum
            : (investmentBalances[state.investmentTypeId] ?? 0) - amountNum
        )}
      </p>
      <p className="mt-0.5 text-small text-text-secondary">{state.investmentTypeName}</p>
    </Card>
  )}
```
Adicionar `investmentBalances: Record<string, number>` às props de `RegistroPreviewPanel` e `FormDataType` já cobre o campo novo automaticamente (é derivado do `ReturnType`).

- [ ] **Step 3: Verificar (typecheck + lint + Playwright)**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.
Playwright: `/registro` (desktop) → painel direito mostra "Saldo do mês" no estado vazio; "Investimento" + selecionar tipo + valor → "Novo total aportado"; "Resgate" + tipo + valor → "Saldo restante"; "Saída"/"Entrada" mantêm o preview atual.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/form-data.ts app/(app)/registro/RegistroPageClient.tsx components/forms/TransactionForm.tsx components/forms/transaction/types.ts
git commit -m "feat(registro): preview contextual para todos os tipos + saldo no estado vazio"
```

---

## Task 8: Verificação final + ds-reviewer

**Files:** nenhum (só verificação; correções pontuais se necessário).

- [ ] **Step 1: Suíte completa**

Run: `npm run lint && npm run format:check && npm run typecheck && npm test`
Expected: tudo verde. Se `format:check` falhar, `npm run format` e re-commit.

- [ ] **Step 2: ds-reviewer sobre os componentes alterados**

Dispatchar o agente `ds-reviewer` uma única vez cobrindo: `components/ui/month-select.tsx`, `components/forms/transaction/HeroAmountCard.tsx`, `components/forms/transaction/SplitSection.tsx`, `components/forms/TransactionForm.tsx`, `components/dashboard/{TransactionEditDialog,FixedExpenseEditDialog,IncomeEditDialog}.tsx`, `app/(app)/registro/RegistroPageClient.tsx`. Corrigir violações apontadas.

- [ ] **Step 3: Passe Playwright de regressão (não quebrar nada)**

Verificar, desktop e mobile:
- Criar: saída avulsa, saída fixa, saída parcelada, entrada, investimento, resgate — todos salvam e revalidam.
- Editar: saída avulsa, fixa, entrada — campos corretos, salvam e revalidam.
- Dialog de criação (FAB "+ Nova") e Drawer mobile funcionam.
- Split: fluxo completo com "registrar só minha parte".

- [ ] **Step 4: Commit final (se houve correções do ds-reviewer/format)**

```bash
git add -A
git commit -m "chore(registro): ajustes de DS e formatação da revisão de lançamento"
```

---

## Self-Review — cobertura do spec

- Consistência criar/editar → Tasks 3, 4 (TransactionForm modo edit + wrappers).
- Polish visual (chips, resgate, ritmo) → Tasks 2, 5.
- SplitSection → Task 6.
- Preview contextual + estado vazio → Task 7.
- Month picker pt-BR → Task 1.
- Backward-compat / nada quebra → props aditivas (Tasks 2, 3), API dos wrappers preservada (Task 4), schemas/actions inalterados, verificação em Task 8.
- Mapa de campos por tipo de edição respeitado → Task 3 (roteamento de submit) + Task 4 (editContext por wrapper).
