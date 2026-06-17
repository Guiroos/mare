# Dark Mode — Design Spec

**Data:** 2026-06-16
**Status:** Aprovado

---

## Objetivo

Adicionar suporte a tema escuro no DS Maré com três opções de controle: Claro, Escuro e Sistema. O usuário controla a preferência pelo `SettingsDialog` existente; a escolha persiste via `localStorage` gerenciado pelo `next-themes`.

---

## Arquitetura

### Dependência

- `next-themes` — biblioteca leve (~4kb) que injeta script inline no `<head>` para aplicar a classe `dark` no `<html>` antes do primeiro paint, eliminando flash de tema errado (FODT).

### Estrutura de arquivos

```
app/layout.tsx                          ← adiciona ThemeProvider + suppressHydrationWarning no <html>
components/providers/ThemeProvider.tsx  ← client component que encapsula next-themes
app/globals.css                         ← adiciona bloco .dark { } com tokens invertidos
components/settings/SettingsDialog.tsx  ← ganha seção "Aparência" com Segment de 3 opções
```

### Fluxo de aplicação do tema

1. No carregamento, `next-themes` lê a preferência do `localStorage`
2. Um script inline aplica `class="dark"` ou `class="light"` no `<html>` antes do paint
3. O bloco `.dark {}` no `globals.css` redefine as CSS vars do DS
4. Todos os componentes que usam tokens (`bg-bg-base`, `text-text-primary`, etc.) mudam automaticamente — zero alteração nos arquivos de componente
5. O hook `useTheme()` no `SettingsDialog` lê e seta a preferência em tempo real

---

## Tokens do tema escuro

Bloco `.dark {}` adicionado ao `globals.css`. Todos os valores usam `oklch()` mantendo o hue e chroma do DS Maré; só o lightness é invertido.

```css
.dark {
  --bg-base:    oklch(14% 0.018 230);
  --bg-surface: oklch(19% 0.016 230);
  --bg-input:   oklch(22% 0.016 230);
  --bg-subtle:  oklch(24% 0.018 228);
  --bg-muted:   oklch(30% 0.018 228);

  --text-primary:   oklch(94% 0.008 225);
  --text-secondary: oklch(65% 0.014 226);
  --text-tertiary:  oklch(48% 0.012 226);
  --text-inverse:   oklch(12% 0.018 230);

  --accent:        oklch(58% 0.14 230);   /* ligeiramente mais brilhante sobre fundo escuro */
  --accent-hover:  oklch(52% 0.14 230);
  --accent-subtle: oklch(22% 0.07 228);
  --accent-text:   oklch(78% 0.10 230);

  --positive:        oklch(54% 0.13 172); /* mantém */
  --positive-hover:  oklch(48% 0.13 172);
  --positive-subtle: oklch(20% 0.07 172);
  --positive-text:   oklch(72% 0.09 172);

  --negative:        oklch(54% 0.13 20);  /* mantém */
  --negative-hover:  oklch(48% 0.13 20);
  --negative-subtle: oklch(20% 0.07 20);
  --negative-text:   oklch(74% 0.10 22);

  --warning:        oklch(72% 0.14 75);   /* mantém */
  --warning-subtle: oklch(20% 0.07 75);
  --warning-text:   oklch(76% 0.10 70);

  --border:       oklch(28% 0.016 228);
  --border-strong: oklch(36% 0.018 228);

  --ring-accent:    oklch(58% 0.14 230 / 0.20);
  --ring-negative:  oklch(54% 0.13 20  / 0.20);

  --shadow-sm: 0 1px 3px oklch(0% 0 0 / 0.25), 0 1px 2px oklch(0% 0 0 / 0.15);
  --shadow-md: 0 4px 12px oklch(0% 0 0 / 0.30), 0 2px 4px oklch(0% 0 0 / 0.20);
  --shadow-lg: 0 12px 32px oklch(0% 0 0 / 0.40), 0 4px 8px oklch(0% 0 0 / 0.25);
}
```

**Tokens sem variação dark** (suficientemente saturados para funcionar sobre fundo escuro):
`--positive`, `--positive-hover`, `--negative`, `--negative-hover`, `--warning`

**Ajuste fino esperado:** os valores de lightness dos tokens de background e texto podem precisar de calibração visual após a implementação — isso é parte do processo de qualquer dark mode.

---

## UI — Toggle no SettingsDialog

Nova seção "Aparência" adicionada ao `SettingsContent`, posicionada **acima** da "Zona de perigo".

Componente usado: `Segment` do DS (3 opções fixas — caso de uso exato).

```
Aparência
Escolha como o app deve aparecer.

[ Claro | Escuro | Sistema ]
```

- Mapeamento: `light` ↔ "Claro" / `dark` ↔ "Escuro" / `system` ↔ "Sistema"
- Mudança **imediata e sem botão de salvar** — o tema aplica ao selecionar
- Usa `useTheme()` de `next-themes`

---

## Fora do escopo (fase 2)

- **Cores hardcoded nos gráficos Recharts** — `MonthlyEvolutionChart`, `ExpensePieChart`, `AnnualStackedChart` e `PatrimonyEvolutionChart` usam hex ou oklch literals fora do sistema de tokens. Os gráficos continuam funcionando no dark (cores distintas e visíveis), mas não mudam com o tema. Será endereçado em sprint separada.
- **`themeColor` do viewport** — atualmente hardcoded como `#1a78c4` em `app/layout.tsx`. Poderia ser dinâmico por tema via `<meta>` tag condicional.

---

## Critérios de sucesso

1. Nenhum flash de tema errado (FODT) em qualquer cenário de carregamento
2. A preferência persiste após recarregar a página e fechar/abrir o browser
3. Opção "Sistema" detecta mudança de preferência do SO em tempo real
4. Todos os componentes do DS que usam tokens mudam corretamente sem `dark:` classes individuais
5. Lint, typecheck e build passam sem erros
