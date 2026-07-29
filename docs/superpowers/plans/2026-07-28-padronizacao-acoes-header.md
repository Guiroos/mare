# Padronização das ações de header — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uniformizar posicionamento e estilo dos botões de "criar" no header das telas, seguindo o padrão de `investimentos`.

**Architecture:** Os dialogs de criação ganham props opcionais (`triggerSize`/`triggerVariant`) para render em dois contextos — header desktop (`md`/`primary`) e seção mobile (`sm`/`outline`). As páginas passam a ter um bloco de ações `hidden lg:flex` no header e a ação compacta `lg:hidden` na seção.

**Tech Stack:** Next.js 14 (App Router), React Server/Client Components, Tailwind (DS Maré), TypeScript.

## Global Constraints

- Botão de header: `size="md"`, ícone `h-4 w-4`, `className="gap-2"`; ação principal `variant="primary"`, secundária `variant="outline"`.
- Ações do header envoltas em `<div className="hidden items-center gap-2 lg:flex">`; contraparte mobile em `lg:hidden`.
- Nunca usar valores arbitrários Tailwind para tokens existentes (Regra 3 do DS).
- Import de tipos sem o modifier `type` (`import { Button, ButtonSize, ButtonVariant }`) — `import { type X }` gera falso positivo no ESLint (`max-warnings 0`).
- Ao fazer múltiplas edições em arquivo de componente, preferir `Write` completo a vários `Edit` (hook `PostToolUse` dispara ds-reviewer/bloqueia imports não usados).
- Gate antes de commitar o conjunto: `npm run lint && npm run format:check && npm run typecheck && npm test`.
- Não há framework de teste de componente; verificação por `typecheck`/`lint` + validação visual via Playwright MCP.

---

### Task 1: Props de trigger em GoalDialog, GroupDialog, AccountDialog

**Files:**
- Modify: `components/metas/GoalDialog.tsx`
- Modify: `components/categorias/GroupDialog.tsx`
- Modify: `components/contas/AccountDialog.tsx`

**Interfaces:**
- Produces: os três dialogs aceitam, no `mode: 'create'`, `triggerSize?: ButtonSize` (default `'sm'`) e `triggerVariant?: ButtonVariant` (default `'outline'`). Ícone do trigger normalizado para `Plus h-4 w-4`; `gap-2` quando `md`, `gap-1.5` caso contrário.

- [ ] **Step 1: GoalDialog — importar tipos e estender Props**

Em `components/metas/GoalDialog.tsx`, trocar a linha de import do Button:

```tsx
import { Button, ButtonSize, ButtonVariant } from '@/components/ui/button'
```

Estender o membro `create` do `type Props` (linhas 26-38):

```tsx
type Props =
  | {
      mode: 'create'
      investmentTypes: InvestmentTypeOption[]
      triggerSize?: ButtonSize
      triggerVariant?: ButtonVariant
    }
  | {
      mode: 'edit'
      investmentTypes: InvestmentTypeOption[]
      goal: {
        id: string
        name: string
        targetAmount: number
        targetDate: string | null
        investmentTypeId: string | null
      }
    }
```

- [ ] **Step 2: GoalDialog — trigger de criar usa as props**

Substituir o bloco `{props.mode === 'create' ? (...) : (...)}` (o trigger, ~linhas 140-153) por:

```tsx
{props.mode === 'create' ? (
  <Button
    size={props.triggerSize ?? 'sm'}
    variant={props.triggerVariant ?? 'outline'}
    className={(props.triggerSize ?? 'sm') === 'md' ? 'gap-2' : 'gap-1.5'}
    onClick={() => setOpen(true)}
  >
    <Plus className="h-4 w-4" />
    Nova meta
  </Button>
) : (
  <Button
    size="icon"
    variant="ghost"
    className="h-7 w-7 text-text-tertiary hover:text-text-primary"
    onClick={() => setOpen(true)}
  >
    <Pencil className="h-3.5 w-3.5" />
  </Button>
)}
```

- [ ] **Step 3: GroupDialog — importar tipos e estender Props**

Em `components/categorias/GroupDialog.tsx`, import:

```tsx
import { Button, ButtonSize, ButtonVariant } from '@/components/ui/button'
```

Estender `type Props` (linha 16):

```tsx
type Props =
  | { mode: 'create'; triggerSize?: ButtonSize; triggerVariant?: ButtonVariant }
  | { mode: 'edit'; group: { id: string; name: string } }
```

- [ ] **Step 4: GroupDialog — trigger de criar usa as props**

Substituir o bloco do trigger de criar (~linhas 75-88):

```tsx
{props.mode === 'create' ? (
  <Button
    size={props.triggerSize ?? 'sm'}
    variant={props.triggerVariant ?? 'outline'}
    className={(props.triggerSize ?? 'sm') === 'md' ? 'gap-2' : 'gap-1.5'}
    onClick={() => setOpen(true)}
  >
    <Plus className="h-4 w-4" />
    Novo grupo
  </Button>
) : (
  <Button
    size="icon"
    variant="ghost"
    className="h-7 w-7 text-text-tertiary hover:text-text-primary"
    onClick={() => setOpen(true)}
  >
    <Pencil className="h-3.5 w-3.5" />
  </Button>
)}
```

- [ ] **Step 5: AccountDialog — importar tipos e estender CreateProps**

Em `components/contas/AccountDialog.tsx`, import:

```tsx
import { Button, ButtonSize, ButtonVariant } from '@/components/ui/button'
```

Estender `CreateProps` (linha 24):

```tsx
type CreateProps = BaseProps & {
  mode: 'create'
  triggerSize?: ButtonSize
  triggerVariant?: ButtonVariant
}
```

- [ ] **Step 6: AccountDialog — trigger de criar usa as props**

Substituir o `const trigger = props.mode === 'create' ? (...) : (...)` (~linhas 143-160). O `mode` é acessado dentro de `AccountDialog(props: Props)`, então `props.triggerSize` está disponível no ramo `create`:

```tsx
const trigger =
  props.mode === 'create' ? (
    <Button
      size={props.triggerSize ?? 'sm'}
      variant={props.triggerVariant ?? 'outline'}
      className={(props.triggerSize ?? 'sm') === 'md' ? 'gap-2' : 'gap-1.5'}
      onClick={() => setOpen(true)}
    >
      <Plus className="h-4 w-4" />
      Nova conta
    </Button>
  ) : (
    <Button
      size="icon"
      variant="ghost"
      className="h-7 w-7 text-text-tertiary hover:text-text-primary"
      onClick={() => setOpen(true)}
    >
      <Pencil className="h-3.5 w-3.5" />
    </Button>
  )
```

- [ ] **Step 7: Verificar typecheck**

Run: `npm run typecheck`
Expected: sem erros. As props novas são opcionais → uso atual (sem passar props) continua válido.

- [ ] **Step 8: Commit**

```bash
git add components/metas/GoalDialog.tsx components/categorias/GroupDialog.tsx components/contas/AccountDialog.tsx
git commit -m "feat(ui): triggerSize/triggerVariant nos dialogs de criar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Prop `size` no ExportButton

**Files:**
- Modify: `components/export/ExportButton.tsx`

**Interfaces:**
- Consumes: `ButtonSize` de `@/components/ui/button`.
- Produces: `ExportButton` aceita `size?: ButtonSize` (default `'sm'`).

- [ ] **Step 1: Adicionar prop size**

Reescrever `components/export/ExportButton.tsx`:

```tsx
import { Download } from 'lucide-react'
import { Button, ButtonSize } from '@/components/ui/button'

type ExportButtonProps = {
  /** URL da rota de exportação, com os filtros já serializados. */
  href: string
  label?: string
  size?: ButtonSize
}

export function ExportButton({ href, label = 'Exportar', size = 'sm' }: ExportButtonProps) {
  return (
    <Button asChild variant="outline" size={size}>
      <a href={href} download>
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
      </a>
    </Button>
  )
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npm run typecheck`
Expected: sem erros. `size` default `'sm'` preserva uso atual em dashboard/historico/panorama.

- [ ] **Step 3: Commit**

```bash
git add components/export/ExportButton.tsx
git commit -m "feat(ui): prop size opcional no ExportButton

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Header de ação em `metas`

**Files:**
- Modify: `app/(app)/metas/page.tsx`

**Interfaces:**
- Consumes: `GoalDialog` com `triggerSize`/`triggerVariant` (Task 1).

- [ ] **Step 1: Adicionar ação no header + tornar a da seção mobile-only**

Substituir o bloco `return (...)` (linhas 22-37) por:

```tsx
  return (
    <PageLayout>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Metas" description="Acompanhe o progresso das suas metas financeiras." />
        <div className="hidden items-center gap-2 lg:flex">
          <GoalDialog
            mode="create"
            investmentTypes={investmentTypeOptions}
            triggerSize="md"
            triggerVariant="primary"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-label font-semibold text-text-secondary">Suas metas</h2>
          <div className="lg:hidden">
            <GoalDialog mode="create" investmentTypes={investmentTypeOptions} />
          </div>
        </div>

        <MetasList goals={goalsData} investmentTypeOptions={investmentTypeOptions} />
      </div>
    </PageLayout>
  )
```

- [ ] **Step 2: Verificar typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Validação visual (Playwright MCP)**

Navegar para `/metas`. Em viewport `lg+` (≥1024px): botão "Nova meta" azul preenchido no canto superior direito do header; o botão da linha "Suas metas" some. Em viewport mobile (<1024px): header sem botão; botão outline compacto na linha "Suas metas".

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/metas/page.tsx"
git commit -m "feat(metas): ação de criar no header com split mobile

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Header de ação em `categorias`

**Files:**
- Modify: `app/(app)/categorias/page.tsx`

**Interfaces:**
- Consumes: `GroupDialog` com `triggerSize`/`triggerVariant` (Task 1).

- [ ] **Step 1: Header com PageHeader + ação; action da Section mobile-only**

Substituir o bloco do header e a abertura da `Section` (linhas 27-33) por:

```tsx
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Categorias e grupos"
          description="Gerencie grupos e categorias de gastos."
        />
        <div className="hidden items-center gap-2 lg:flex">
          <GroupDialog mode="create" triggerSize="md" triggerVariant="primary" />
        </div>
      </div>

      <Section
        title="Grupos e categorias"
        action={
          <div className="lg:hidden">
            <GroupDialog mode="create" />
          </div>
        }
      >
```

(o `PageHeader` deixa de ser irmão direto do `PageLayout` e passa a viver dentro do `<div className="flex items-start justify-between gap-4">`.)

- [ ] **Step 2: Verificar typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Validação visual (Playwright MCP)**

Navegar para `/categorias`. `lg+`: "Novo grupo" primário no header; header da Section sem botão. Mobile: header sem botão; "Novo grupo" outline no header da Section.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/categorias/page.tsx"
git commit -m "feat(categorias): ação de criar no header com split mobile

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Header de ação em `contas`

**Files:**
- Modify: `app/(app)/contas/page.tsx`

**Interfaces:**
- Consumes: `AccountDialog` com `triggerSize`/`triggerVariant` (Task 1).

- [ ] **Step 1: Header com PageHeader + ação; action da Section mobile-only**

Substituir o bloco do header e a abertura da `Section` (linhas 36-41) por:

```tsx
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Contas e Cartões"
          description="Gerencie suas contas de débito, crédito e Pix."
        />
        <div className="hidden items-center gap-2 lg:flex">
          <AccountDialog mode="create" triggerSize="md" triggerVariant="primary" />
        </div>
      </div>

      <Section
        title="Contas e cartões"
        action={
          <div className="lg:hidden">
            <AccountDialog mode="create" />
          </div>
        }
      >
```

- [ ] **Step 2: Verificar typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Validação visual (Playwright MCP)**

Navegar para `/contas`. `lg+`: "Nova conta" primário no header; header da Section sem botão. Mobile: botão outline no header da Section.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/contas/page.tsx"
git commit -m "feat(contas): ação de criar no header com split mobile

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Alinhar header de `devedores` ao padrão

**Files:**
- Modify: `app/(app)/devedores/page.tsx`

**Interfaces:**
- Consumes: `ExportButton` com `size` (Task 2). `PersonDialog mode="create"` já é `variant="primary" size="md"`.

- [ ] **Step 1: Header hidden lg:flex + Export md; contraparte mobile na Section**

Substituir o bloco de header e a `Section` "Pessoas" (linhas 28-45) por:

```tsx
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Devedores"
          description="Acompanhe valores que outras pessoas devem a você."
        />
        <div className="hidden flex-shrink-0 items-center gap-2 lg:flex">
          <ExportButton href="/api/export/devedores" size="md" />
          <PersonDialog mode="create" />
        </div>
      </div>

      <PixKeyCard pixKey={pixKey} />

      <DebtorSummaryCards people={people} />

      <Section
        title="Pessoas"
        action={
          <div className="flex items-center gap-2 lg:hidden">
            <ExportButton href="/api/export/devedores" />
            <PersonDialog mode="create" />
          </div>
        }
      >
        <DebtorList people={people} openChargesByPerson={openChargesByPerson} pixKey={pixKey} />
      </Section>
```

Nota: o `PersonDialog` na Section (mobile) fica `size="md" primary` (padrão do próprio componente); é aceitável — é a única ação primária da tela e o `PersonDialog` não expõe `triggerSize`. Se ficar grande no mobile, considerar em rodada futura; fora de escopo aqui.

- [ ] **Step 2: Verificar typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Validação visual (Playwright MCP)**

Navegar para `/devedores`. `lg+`: Export (outline md) + "Nova pessoa" (primário md) no header, mesma altura; header da Section "Pessoas" sem ações. Mobile: header sem ações; Export + "Nova pessoa" no header da Section "Pessoas".

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/devedores/page.tsx"
git commit -m "feat(devedores): alinhar ações do header ao padrão com split mobile

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Botão "Lançamento" no dashboard

**Files:**
- Modify: `components/dashboard/DashboardFAB.tsx`

**Interfaces:**
- Consumes: `Button` (`variant="primary"`), `useRegistrationDialog`.

- [ ] **Step 1: Relabel + estilo canônico**

Substituir o `return` de `DashboardFAB` (linhas 22-27):

```tsx
  return (
    <Button
      variant="primary"
      size="sm"
      onClick={handleClick}
      className="hidden gap-2 lg:flex"
    >
      <Plus className="h-4 w-4" />
      Lançamento
    </Button>
  )
```

- [ ] **Step 2: Verificar typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Validação visual (Playwright MCP)**

Navegar para `/dashboard` em `lg+`: no slot de ações do `MonthSelector`, "Exportar" (outline) + "Lançamento" (primário) lado a lado, mesma altura (`sm`). Clicar em "Lançamento" abre o dialog de registro. Mobile: botão não aparece (criação via `+` do bottom nav).

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/DashboardFAB.tsx
git commit -m "feat(dashboard): botão Lançamento primário no header

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Gate final e verificação de suíte

**Files:** nenhum (validação).

- [ ] **Step 1: Rodar a suíte completa**

Run: `npm run lint && npm run format:check && npm run typecheck && npm test`
Expected: tudo verde. Se `format:check` falhar, rodar `npm run format` e recommitar os arquivos afetados no commit da task correspondente (não criar commit separado de formatação isolado se puder emendar).

- [ ] **Step 2: Revisão visual consolidada (Playwright MCP)**

Percorrer `/metas`, `/categorias`, `/contas`, `/devedores`, `/dashboard`, `/investimentos` em `lg+` e mobile. Confirmar: mesmo tamanho (`md`) e alinhamento dos botões de header entre as páginas; ação única = primário; sem botão duplicado no desktop; ação compacta presente no mobile.
