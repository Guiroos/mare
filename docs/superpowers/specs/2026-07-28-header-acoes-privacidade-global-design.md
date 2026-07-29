# Reorganização das ações do header — privacidade global no shell

Data: 2026-07-28

## Problema

O header do dashboard acumula tipos de ação heterogêneos numa mesma linha: navegação de
mês, seletor de ciclo de fatura, botão "Mês atual", Exportar, toggle de privacidade (olho)
e "+ Nova". Com o Exportar recém-adicionado, ficou muita ação concorrendo por espaço, sem
hierarquia clara entre "contexto de tempo", "preferência de exibição" e "ação sobre o dado".

Além disso, o `PrivacyToggle` (olho) é renderizado **solto no header de 5 páginas** —
`dashboard`, `investimentos`, `metas`, `panorama`, `historico`. Ele é uma preferência
**global** de exibição (o `PrivacyModeProvider` envolve o app inteiro em
`app/(app)/layout.tsx`), mas está duplicado e mal ancorado em cada página. Ou seja,
"privacidade mal posicionada" não é um problema só do dashboard — é sistêmico.

## Princípio de design

Separar tipos de ação por onde eles pertencem:

- **Contexto de tempo** (qual período estou vendo) → permanece no header da página.
- **Preferência global de exibição** (privacidade) → vai para o shell do app.
- **Ações sobre o dado** (Exportar, + Nova) → permanecem no header, agrupadas.

O toggle de privacidade **já existe** dentro do `SettingsDialog` (`usePrivacyMode()` →
`isPrivate`/`toggle`). Portanto o olho por-página é apenas um atalho rápido redundante — o
que precisamos no shell é um acesso de 1 clique, não uma nova fonte de verdade.

## Mudanças

### 1. Acesso rápido à privacidade no shell

Reusar o hook `usePrivacyMode()` de `components/providers/PrivacyMode.tsx` — nenhum
componente novo pesado. O provider já envolve `Sidebar` e `BottomNav`, então o hook
funciona nos dois contextos.

**Sidebar (desktop)** — `components/layout/Sidebar.tsx`, rodapé do avatar:

- Adicionar um botão de olho (`Eye`/`EyeOff` de `lucide-react`) como **irmão** do
  `DropdownMenu.Trigger` do avatar, **não aninhado** dentro do `<button>` do trigger
  (botão dentro de botão é HTML inválido).
- O trigger do avatar passa a `flex-1`; o olho fica ao lado, à direita.
- `aria-label` alterna entre "Mostrar valores" / "Ocultar valores" conforme `isPrivate`.

```
┌───────────────────────┐
│ [GR] Guilherme    [👁] │  ← olho, 1 clique, sibling do trigger
│      email@...         │
└───────────────────────┘
```

**BottomNav (mobile)** — `components/layout/BottomNav.tsx`, sheet Menu:

- Adicionar uma linha de toggle "Ocultar valores" / "Mostrar valores" no mesmo padrão
  visual dos itens Feedback/Configurações/Sair (`Button variant="ghost"` com
  `justify-start gap-3 border border-border`, ícone `Eye`/`EyeOff`).
- Posicionar junto ao bloco de controles do app (antes de Configurações).

### 2. Remover `PrivacyToggle` das páginas

Remover o import e o uso de `PrivacyToggle` de:

- `app/(app)/dashboard/page.tsx` — o `action` do `MonthSelector` deixa de incluí-lo.
- `app/(app)/investimentos/page.tsx`
- `app/(app)/metas/page.tsx`
- `app/(app)/panorama/page.tsx`
- `app/(app)/historico/page.tsx`

Ajustar o layout de cada header/action para fechar o espaço deixado pelo olho, seguindo o
padrão existente de cada página. O componente `PrivacyToggle` em `PrivacyMode.tsx` pode ser
mantido (não quebra nada) ou removido se ficar sem uso — decidir na implementação após
confirmar que não há outros consumidores.

### 3. Header do dashboard — agrupar ações de dado

Com o olho fora, o `action` passado ao `MonthSelector` fica apenas `ExportButton` +
`DashboardFAB` (Exportar + Nova = ações de dado).

Para reforçar a separação "tempo" vs "dado", o `MonthSelector`
(`components/dashboard/MonthSelector.tsx`) insere um `Separator orientation="vertical"`
(de `components/ui/separator.tsx`) **antes** do `{action}`, exibido apenas quando existe
grupo de tempo à esquerda dele (seletor de ciclo e/ou botão "Mês atual") **e** `action`
está presente. Resultado no grupo direito:

```
… [Mês ▾]  [Mês atual]  │  [⬇ Exportar]  [+ Nova]
   └──── contexto de tempo ────┘   └── ações de dado ──┘
```

O separador é decorativo/estrutural; se a inserção condicional ficar frágil, aceitável
começar sempre-visível quando `action` existe e refinar depois.

## Escopo

**Tocado:**
- `components/layout/Sidebar.tsx`
- `components/layout/BottomNav.tsx`
- `components/dashboard/MonthSelector.tsx`
- `app/(app)/dashboard/page.tsx`
- `app/(app)/investimentos/page.tsx`
- `app/(app)/metas/page.tsx`
- `app/(app)/panorama/page.tsx`
- `app/(app)/historico/page.tsx`

**Intacto:**
- `components/providers/PrivacyMode.tsx` (provider e hook) — comportamento de mascaramento
  inalterado.
- `components/settings/SettingsDialog.tsx` — o toggle existente permanece.

## Fora de escopo (YAGNI)

- Não alterar o comportamento de mascaramento de valores.
- Não criar topbar persistente no mobile.
- Não redesenhar o visual do botão Exportar.
- Nenhum refactor não relacionado nos headers das outras páginas além da remoção do olho.

## Critérios de sucesso

- O olho não aparece mais no header de nenhuma das 5 páginas.
- Privacidade é alternável em 1 clique no desktop (rodapé do sidebar) e via sheet Menu no
  mobile; o estado continua sincronizado (mesmo `localStorage` / `usePrivacyMode`).
- O header do dashboard exibe apenas contexto de tempo à esquerda do separador e Exportar +
  Nova à direita.
- `npm run lint && npm run format:check && npm run typecheck && npm test` passam.
