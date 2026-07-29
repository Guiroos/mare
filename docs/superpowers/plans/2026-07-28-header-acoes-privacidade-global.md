# Reorganização das ações do header — privacidade global no shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover o toggle de privacidade dos headers de página para o shell do app (sidebar no desktop, sheet Menu no mobile) e reagrupar o header do dashboard, separando contexto de tempo de ações de dado.

**Architecture:** O `PrivacyModeProvider` já envolve `Sidebar` e `BottomNav` em `app/(app)/layout.tsx`, então `usePrivacyMode()` funciona no shell. Adicionamos acesso rápido de 1 clique no shell, removemos o `PrivacyToggle` das 5 páginas que o renderizavam solto, e inserimos um separador visual no `MonthSelector` entre o grupo de tempo e as ações de dado. Sem alterar o comportamento de mascaramento.

**Tech Stack:** Next.js 14 (App Router), React, Tailwind (DS Maré), Radix (DropdownMenu/Dialog/Separator), lucide-react.

## Global Constraints

- Comunicação e commits em pt-BR (código/identificadores em inglês); commits em Conventional Commits.
- Zero valores arbitrários Tailwind — usar apenas tokens do `tailwind.config.ts` (Regra 3 do DS).
- `className` sempre via `cn()` de `lib/utils/cn`.
- Um componente por arquivo; compostos usam primitivos do DS.
- **Hook `PostToolUse:Edit` bloqueia edits que deixam imports não usados** — ao remover a última utilização de um import, remover import + uso na MESMA operação via `Write` (Read o arquivo antes e reproduza-o verbatim, menos as linhas indicadas).
- Hook `PostToolUse:Write` dispara o `ds-reviewer` — ao fazer múltiplas edições num componente, preferir um único `Write` completo.
- Não há harness de teste de componente (RTL) no projeto; mudanças presentacionais são verificadas por `npm run typecheck` + `npm run lint` + suíte existente verde + smoke visual. Não criar infra de teste nova.
- Gate antes de commit final: `npm run lint && npm run format:check && npm run typecheck && npm test`.

---

### Task 1: Acesso rápido à privacidade no shell (Sidebar + BottomNav)

**Files:**
- Modify: `components/layout/Sidebar.tsx` (rodapé do avatar, ~176-195)
- Modify: `components/layout/BottomNav.tsx` (imports + sheet Menu, ~200-260)

**Interfaces:**
- Consumes: `usePrivacyMode()` de `@/components/providers/PrivacyMode` → `{ isPrivate: boolean, toggle: () => void, mask }`; `PrivacyToggle` (Button ghost icon-only, `Eye`/`EyeOff`) do mesmo módulo.
- Produces: nenhum export novo. Após esta task, o olho de privacidade funciona no shell em desktop e mobile, com estado sincronizado via `localStorage` (o mesmo do provider).

- [ ] **Step 1: Sidebar — importar `PrivacyToggle`**

Em `components/layout/Sidebar.tsx`, junto aos imports de topo, adicionar:

```tsx
import { PrivacyToggle } from '@/components/providers/PrivacyMode'
```

`PrivacyToggle` já é um `Button variant="ghost" size="icon"` com `Eye`/`EyeOff` e `aria-label` que alterna "Mostrar valores"/"Ocultar valores" — reusar em vez de recriar.

- [ ] **Step 2: Sidebar — colocar o olho como irmão do trigger do avatar**

No rodapé (`<div className="mt-auto border-t border-border p-3">`), envolver o `DropdownMenu.Root` e o `PrivacyToggle` numa linha flex, e trocar `w-full` do trigger por `min-w-0 flex-1`. Como o arquivo tem várias linhas afetadas e é componente (dispara `ds-reviewer`), reescrever o rodapé via `Write` do arquivo inteiro (Read antes). O bloco final do rodapé deve ficar:

```tsx
      {/* User footer */}
      <div className="mt-auto border-t border-border p-3">
        <div className="flex items-center gap-1">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md p-2 transition-colors hover:bg-bg-subtle">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-caption font-semibold text-white"
                  style={{
                    background: 'linear-gradient(135deg, oklch(70% 0.1 180), oklch(55% 0.12 210))',
                  }}
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="truncate text-small font-semibold text-text-primary">
                    {user?.name ?? '—'}
                  </div>
                  <div className="truncate text-caption text-text-tertiary">{user?.email ?? ''}</div>
                </div>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                side="top"
                align="start"
                sideOffset={4}
                className="z-50 min-w-48 overflow-hidden rounded-md border border-border bg-bg-surface shadow-md"
              >
                <DropdownMenu.Item
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-small text-text-primary outline-none transition-colors hover:bg-bg-subtle focus:bg-bg-subtle"
                  onSelect={(e) => {
                    e.preventDefault()
                    setFeedbackOpen(true)
                  }}
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  Enviar feedback
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-small text-text-primary outline-none transition-colors hover:bg-bg-subtle focus:bg-bg-subtle"
                  onSelect={(e) => {
                    e.preventDefault()
                    setSettingsOpen(true)
                  }}
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  Configurações
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Item
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-small text-text-primary outline-none transition-colors hover:bg-bg-subtle focus:bg-bg-subtle"
                  onSelect={() => signOut({ callbackUrl: '/login' })}
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  Sair
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <PrivacyToggle />
        </div>
      </div>
```

(Preservar o restante do arquivo verbatim: imports, `mainNav`/`configNav`, `NavItem`, logo, navs, e os `<FeedbackDialog>`/`<SettingsDialog>` no final do `<aside>`.)

- [ ] **Step 3: Rodar typecheck e lint (Sidebar)**

```bash
npm run typecheck && npm run lint
```
Expected: PASS, 0 warnings.

- [ ] **Step 4: BottomNav — imports do toggle**

Em `components/layout/BottomNav.tsx`, adicionar `Eye` e `EyeOff` ao import de `lucide-react` (junto aos ícones já importados) e adicionar:

```tsx
import { usePrivacyMode } from '@/components/providers/PrivacyMode'
```

- [ ] **Step 5: BottomNav — ler o estado de privacidade**

Dentro do componente `BottomNav`, junto aos outros hooks (`const { open } = useRegistrationDialog()`), adicionar:

```tsx
  const { isPrivate, toggle: togglePrivacy } = usePrivacyMode()
```

- [ ] **Step 6: BottomNav — botão de privacidade no sheet Menu**

No `<DialogContent>` do sheet Menu, **antes** do botão "Enviar feedback", inserir o botão de toggle (fecha o menu ao alternar para o usuário ver o efeito). Como é componente e há múltiplas mudanças, aplicar via `Write` do arquivo inteiro (Read antes), inserindo:

```tsx
          <Button
            variant="ghost"
            onClick={() => {
              setMenuOpen(false)
              togglePrivacy()
            }}
            className="w-full justify-start gap-3 border border-border"
          >
            {isPrivate ? (
              <EyeOff className="h-4 w-4 shrink-0" />
            ) : (
              <Eye className="h-4 w-4 shrink-0" />
            )}
            {isPrivate ? 'Mostrar valores' : 'Ocultar valores'}
          </Button>
```

(Preservar todo o resto do arquivo verbatim: `primaryNav`, `menuItems`, `NavItem`, a `<nav>` fixa com FAB, o grid de `menuItems`, e os botões Feedback/Configurações/Sair na ordem original — o novo botão vem logo antes do "Enviar feedback".)

- [ ] **Step 7: Rodar typecheck e lint (BottomNav)**

```bash
npm run typecheck && npm run lint
```
Expected: PASS, 0 warnings.

- [ ] **Step 8: Smoke visual do shell**

`npm run dev` e verificar:
- Desktop (≥1024px): olho aparece no rodapé do sidebar, ao lado do avatar; clicar mascara/revela valores no dashboard; ícone alterna `Eye`↔`EyeOff`.
- Mobile (<1024px, DevTools responsive): abrir "Menu" no bottom nav → linha "Ocultar valores"/"Mostrar valores" presente; tocar fecha o menu e alterna o mascaramento; o rótulo reflete o estado ao reabrir.
- Estado persiste ao recarregar (localStorage `mare:privacy-mode`).

- [ ] **Step 9: Commit**

```bash
git add components/layout/Sidebar.tsx components/layout/BottomNav.tsx
git commit -m "feat(shell): acesso rápido à privacidade no sidebar e no menu mobile

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Remover `PrivacyToggle` das 5 páginas

**Files:**
- Modify: `app/(app)/dashboard/page.tsx` (import ~30, action ~127-135)
- Modify: `app/(app)/investimentos/page.tsx` (import ~24, uso ~95)
- Modify: `app/(app)/metas/page.tsx` (import ~6, uso ~27)
- Modify: `app/(app)/panorama/page.tsx` (import ~20, uso ~83)
- Modify: `app/(app)/historico/page.tsx` (import ~13, uso ~59)

**Interfaces:**
- Consumes: acesso à privacidade no shell (Task 1) — por isso esta task vem depois, para o usuário nunca ficar sem o toggle.
- Produces: nenhum export novo. O `PrivacyToggle` deixa de ser usado por estas páginas.

> **Atenção ao hook:** em cada arquivo, remover o `import { PrivacyToggle }` e o(s) uso(s) `<PrivacyToggle />` juntos, via `Write` do arquivo inteiro (Read antes e reproduza verbatim, menos essas linhas). Remover só o uso deixaria o import órfão e o hook `PostToolUse:Edit` bloquearia.

- [ ] **Step 1: Dashboard — remover olho e reagrupar action**

Em `app/(app)/dashboard/page.tsx`:
- Remover a linha `import { ExportButton } ...`? Não — manter `ExportButton`. Remover apenas:
  ```tsx
  import { PrivacyToggle, SensitiveMoneyBadge } from '@/components/providers/PrivacyMode'
  ```
  → passa a:
  ```tsx
  import { SensitiveMoneyBadge } from '@/components/providers/PrivacyMode'
  ```
  (`SensitiveMoneyBadge` continua em uso nas seções Entradas/Investimentos — **não** remover.)
- No `action` do `<MonthSelector>`, remover a linha `<PrivacyToggle />`. O bloco fica:
  ```tsx
        action={
          <div className="flex items-center gap-1">
            <ExportButton
              href={`/api/export/extrato?de=${exportRange.de}&ate=${exportRange.ate}`}
            />
            <DashboardFAB month={month} />
          </div>
        }
  ```

- [ ] **Step 2: Investimentos — remover olho**

Em `app/(app)/investimentos/page.tsx`:
- Remover `import { PrivacyToggle } from '@/components/providers/PrivacyMode'` (linha ~24).
- Na div `<div className="hidden items-center gap-2 lg:flex">`, remover a linha `<PrivacyToggle />`. A div fica com `<InvestmentTypeDialog ... />` + `<InvestmentEntryDialog ... />`.

- [ ] **Step 3: Metas — remover olho**

Em `app/(app)/metas/page.tsx`:
- Remover `import { PrivacyToggle } from '@/components/providers/PrivacyMode'` (linha ~6).
- Na div `<div className="flex items-start justify-between gap-4">`, remover a linha `<PrivacyToggle />`. A div fica só com `<PageHeader ... />` (o `justify-between` é inofensivo com um filho; manter como está).

- [ ] **Step 4: Panorama — remover olho**

Em `app/(app)/panorama/page.tsx`:
- Remover `import { PrivacyToggle } from '@/components/providers/PrivacyMode'` (linha ~20).
- Na div `<div className="flex flex-shrink-0 items-center gap-2">`, remover a linha `<PrivacyToggle />`. A div fica com `<YearSelector ... />` + `<ExportButton ... />`.

- [ ] **Step 5: Histórico — remover olho**

Em `app/(app)/historico/page.tsx`:
- Remover `import { PrivacyToggle } from '@/components/providers/PrivacyMode'` (linha ~13).
- Na div `<div className="flex flex-shrink-0 items-center gap-2">`, remover a linha `<PrivacyToggle />`. A div fica só com `<ExportButton ... />`.

- [ ] **Step 6: Rodar typecheck e lint**

```bash
npm run typecheck && npm run lint
```
Expected: PASS, 0 warnings (nenhum import órfão de `PrivacyToggle`).

- [ ] **Step 7: Smoke visual**

`npm run dev` e confirmar que o olho **não** aparece mais no header de: dashboard, investimentos, metas, panorama, histórico. O mascaramento ainda funciona via shell (Task 1) em todas elas.

- [ ] **Step 8: Commit**

```bash
git add app/\(app\)/dashboard/page.tsx app/\(app\)/investimentos/page.tsx app/\(app\)/metas/page.tsx app/\(app\)/panorama/page.tsx app/\(app\)/historico/page.tsx
git commit -m "refactor(privacy): remover toggle de privacidade dos headers de página

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Separador de grupos no `MonthSelector`

**Files:**
- Modify: `components/dashboard/MonthSelector.tsx` (import + grupo direito ~90-126)

**Interfaces:**
- Consumes: `Separator` de `@/components/ui/separator` (Radix; `orientation="vertical"` renderiza `h-full w-[1px] bg-border` — precisa de altura explícita numa linha `items-center`, por isso `className="h-6"`).
- Produces: nenhum export novo. Header do dashboard passa a exibir separador entre o grupo de tempo (ciclo / "Mês atual") e o `{action}` (Exportar + Nova), quando ambos existem.

- [ ] **Step 1: Importar `Separator`**

Em `components/dashboard/MonthSelector.tsx`, adicionar aos imports:

```tsx
import { Separator } from '@/components/ui/separator'
```

- [ ] **Step 2: Inserir o separador condicional antes de `{action}`**

No grupo direito (`<div className="flex items-center gap-2">`), imediatamente antes de `{action}`, inserir. Como é componente, aplicar via `Write` do arquivo inteiro (Read antes). O grupo direito fica:

```tsx
        <div className="flex items-center gap-2">
          {hasBillingCycle && (
            <Select value={activeCycleAccountId ?? 'month'} onValueChange={handleCycleSelect}>
              <SelectTrigger
                className={cn(
                  'h-7 w-auto gap-1.5 rounded-full px-3 text-caption font-semibold active:scale-95',
                  isCycleView
                    ? 'border-transparent bg-accent text-text-inverse shadow-sm hover:shadow-md'
                    : 'border-border bg-bg-surface text-text-secondary hover:bg-bg-subtle'
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={6} align="end" className="min-w-40">
                <SelectItem value="month">Mês</SelectItem>
                {creditAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} · dia {account.closingDay}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {!isCurrentMonth && (
            <Button
              variant="primary"
              size="xs"
              onClick={() => navigate(currentYearMonth())}
              className="rounded-full"
              rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
            >
              Mês atual
            </Button>
          )}

          {action && (hasBillingCycle || !isCurrentMonth) && (
            <Separator orientation="vertical" className="mx-1 h-6" />
          )}
          {action}
        </div>
```

(Preservar o restante do arquivo verbatim.)

- [ ] **Step 3: Rodar typecheck e lint**

```bash
npm run typecheck && npm run lint
```
Expected: PASS, 0 warnings.

- [ ] **Step 4: Smoke visual do separador**

`npm run dev` no dashboard:
- Mês atual, sem conta de crédito com ciclo: sem grupo de tempo à esquerda do action → **sem** separador (só `[Exportar] [+ Nova]`).
- Navegar para mês anterior (aparece "Mês atual"): separador visível entre "Mês atual" e Exportar.
- Com conta de crédito com `closingDay > 1` (seletor "Mês ▾" presente): separador visível entre o seletor e Exportar.
- Sem transbordo horizontal no mobile.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/MonthSelector.tsx
git commit -m "feat(dashboard): separar contexto de tempo das ações de dado no header

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Gate final

- [ ] **Rodar a suíte completa**

```bash
npm run lint && npm run format:check && npm run typecheck && npm test
```
Expected: tudo PASS. Se `format:check` reclamar, rodar `npm run format` (ou `npx prettier --write` nos arquivos tocados) e re-verificar antes de considerar concluído.

## Self-review (cobertura do spec)

- Spec §1 (acesso rápido no shell: Sidebar desktop + BottomNav mobile) → Task 1. ✓
- Spec §2 (remover `PrivacyToggle` das 5 páginas) → Task 2. ✓
- Spec §3 (header do dashboard: action só Exportar+Nova + separador no MonthSelector) → Task 2 Step 1 (remoção/agrupamento) + Task 3 (separador). ✓
- Spec "intacto" (provider e SettingsDialog) → nenhuma task os toca. ✓
- Spec critérios de sucesso (olho fora das páginas; 1 clique no desktop; sheet no mobile; estado sincronizado; header agrupado; gate verde) → Tasks 1-3 + Gate final. ✓
- Sem placeholders; nomes consistentes (`usePrivacyMode`, `PrivacyToggle`, `togglePrivacy`, `Separator`).
