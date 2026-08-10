# design-sync — notas deste repo

Projeto no Claude Design: `Maré Design System` — https://claude.ai/design/p/3d945b1a-3e22-4e7f-bc3c-90273160c4d7
(o `projectId` está em `config.json`; não trocar sem motivo)

## Pré-passos obrigatórios antes de rodar o conversor

O Maré é um **app Next.js**, não um pacote publicado: não existe `dist/`, não existe `.d.ts`
gerado e o CSS é Tailwind não-compilado. Três coisas precisam existir antes de `package-build.mjs`,
e nenhuma delas é feita pelo conversor:

1. **Self-link do pacote** — `ln -sfn .. node_modules/mare`
   Sem isso o build morre em `ENOENT … node_modules/mare/package.json`: `dts.mjs` resolve o
   pacote por `<node_modules>/<pkg>` e npm nunca se auto-instala. O link é gitignorado
   (`/node_modules`), então **recriar em todo clone**.

2. **Compilar o CSS** — `npx tailwindcss -c .design-sync/tailwind.ds.config.ts -i app/globals.css -o .design-sync/build/ds.css --minify`
   `cfg.cssEntry` aponta para o resultado. `.design-sync/build/` é gitignorado (artefato
   reproduzível), então **recompilar em todo clone e sempre que os componentes mudarem de
   classe** — o Tailwind só emite as utilities que encontrou no scan.
   `tailwind.ds.config.ts` (committado) estende o `tailwind.config.ts` real com:
   - `content` incluindo `.design-sync/previews/**` (senão as classes usadas só nos previews somem);
   - um `safelist` com todo o vocabulário de tokens do DS (cores, tipografia, radius, sombras).
     Isso existe porque o agente de design escreve classes que **este app ainda não usa** —
     sem o safelist elas não estariam no CSS e o layout dele sairia sem estilo.

3. **Copiar o guideline** — `cp .claude/ds-components.md .design-sync/guidelines/ds-components.md`
   A API do Claude Design **recusa upload de qualquer path sob `.claude/`** (HTTP 403,
   `permission_denied … reserved paths`), então o arquivo tem que ser sincronizado por cópia.
   A cópia é committada; se `.claude/ds-components.md` mudar, refazer a cópia.

Comando único para os três:

```sh
ln -sfn .. node_modules/mare
npx tailwindcss -c .design-sync/tailwind.ds.config.ts -i app/globals.css -o .design-sync/build/ds.css --minify
cp .claude/ds-components.md .design-sync/guidelines/ds-components.md
```

## Fontes

DM Sans vem do `next/font/google`, que baixa e auto-hospeda em `.next/`. Os dois `.woff2`
(subsets latin e latin-ext, arquivo variável — todos os pesos apontam para o mesmo file) foram
**colhidos de `.next/dev/static/media/` e committados em `.design-sync/fonts/`**, com um
`dm-sans.css` escrito à mão declarando os pesos 300–700. Isso torna o bundle self-contained
(sem rede, sem CDN). Se a versão da fonte mudar no Google, os arquivos aqui **não** acompanham —
recolher de `.next/dev/static/css/app/layout.css` (é lá que estão os `@font-face` com os hashes).

## Playwright / chromium

Não há browser do Playwright em cache nesta máquina, mas existe `/usr/bin/chromium` do sistema.
Instalado `playwright` com `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` e usado o chromium do sistema via
a env var que os scripts suportam:

```sh
DS_CHROMIUM_PATH=/usr/bin/chromium node .ds-sync/package-validate.mjs ./ds-bundle
DS_CHROMIUM_PATH=/usr/bin/chromium node .ds-sync/package-capture.mjs --out ./ds-bundle
```

Sem a env var o launch falha com `Executable doesn't exist`. `package-capture.mjs` completo
leva **mais de 2 minutos** — rodar em background, nunca em foreground com timeout curto.

## `.d.ts` — por que `dtsPropsFor` cobre os 30

Sem `dist/`, `dts.mjs` roda em modo synth-entry e procura `<Name>Props` na árvore de `.d.ts`,
que aqui só contém `types/next-auth.d.ts`. Resultado: **todos os 30 componentes saíam com
`[key: string]: unknown`** — contrato inútil para o agente de design. Além disso, as interfaces
de props em `components/ui/*.tsx` **não são exportadas**, então nem um `tsc --emitDeclarationOnly`
resolveria de forma limpa.

Por isso `cfg.dtsPropsFor` tem entrada escrita à mão para os 30, derivada do source.
**Isso apodrece**: mudou a assinatura de um componente em `components/ui/`, atualizar a entrada
correspondente no `config.json`. Não existe gate automático para isso — é a maior dívida deste
setup.

## Decisões de escopo

- `componentSrcMap` fixa os 30 componentes com card próprio e exclui com `null` os sub-exports
  (`DialogContent`, `SelectItem`, `TxItem`, `ListFooter`, …) e os type-only (`ButtonVariant`,
  `ComboboxOption`, …). **Os excluídos continuam no bundle** (`window.MareDS` tem 61 exports) —
  só não ganham card. Composições que os usam estão nos previews de `Dialog`, `Select`, `TxList`.
- `cfg.overrides`: `Dialog` e `Drawer` usam `cardMode: single` + `viewport` porque renderizam
  abertos (o portal do Radix/vaul escapa da célula de grid); `PageHeader` usa `cardMode: column`
  (o `[GRID_OVERFLOW]` apontou o story `ComAcao`).
- `tokens/` sai vazio de propósito: os tokens do Maré são custom properties dentro do próprio
  `_ds_bundle.css` (bloco `:root` + `.dark` de `app/globals.css`), que `styles.css` importa.
  O vocabulário está enumerado em `conventions.md`.

## Gates do repo

`.design-sync/`, `.ds-sync/` e `ds-bundle/` foram adicionados aos `ignores` do
`eslint.config.mjs` e ao `.prettierignore` (o `build/` e `fonts/`), pela mesma razão que
`.claude/` já estava: é tooling, não source. Sem isso, um import não usado num preview quebra
`npm run lint --max-warnings 0`.

## Known render warns

Nenhum warn recorrente até agora além do `[GRID_OVERFLOW]` do `PageHeader`, já resolvido pelo
override. `[NO_DIST]` é esperado e permanente neste repo (ver acima).

## Estados que não dá para capturar estaticamente

- `Combobox`: a lista só abre no `focus` do input, então os cards mostram o estado de repouso
  (input + valor selecionado). A lista aberta não é capturável sem interação.
- `MultiselectDropdown` e `RowActions`: o conteúdo do Radix DropdownMenu só existe depois do
  clique — os cards mostram o gatilho (pill / kebab), que é o estado real em lista.
- `DeleteButton`: idem, mostra o botão de lixeira; o diálogo de confirmação está coberto pelo
  card do `Dialog`.

## Re-sync — riscos de ficar desatualizado

- **`dtsPropsFor` é cópia manual do source.** É a coisa mais provável de mentir num re-sync.
  Antes de subir, conferir os componentes que mudaram desde o último sync
  (`git log --since=<data> -- components/ui/`) contra as entradas do config.
- **`.design-sync/guidelines/ds-components.md` é cópia de `.claude/ds-components.md`.** Não há
  link nem gate; diverge em silêncio.
- **`.design-sync/build/ds.css` é gitignorado.** Um re-sync que esqueça de recompilar sobe o CSS
  do build anterior — ou falha com `[CSS_IMPORT_MISSING]` se o arquivo não existir.
- **As fontes são um snapshot do `.next/`.** Não seguem upgrade de `next` nem do Google Fonts.
- **`node_modules/mare` é symlink gitignorado.** Todo clone novo precisa recriar, ou o build
  morre antes de qualquer coisa.
- Os previews em `.design-sync/previews/` importam de `'mare'` e usam props reais; se um
  componente perder uma prop, o preview compila mesmo assim (esbuild não checa tipos) e o
  problema só aparece no screenshot. O `package-capture.mjs` + as grades são o único sinal.

## Aprendizados do primeiro sync (2026-08-10)

- **`guidelines/` sai aninhado**: o conversor preserva o path do glob, então o arquivo chega ao
  projeto como `guidelines/.design-sync/guidelines/ds-components.md`. É cosmético e funciona;
  para achatar seria preciso um glob a partir de outro diretório.
- **Previews de `Dialog` precisam de `onOpenAutoFocus={(e) => e.preventDefault()}`**: sem isso o
  Radix foca o primeiro input e o screenshot captura o texto selecionado em azul e o anel de foco
  no botão — parece bug no card.
- **`Label` concatena `className` com template string, sem `twMerge`**: passar `text-body` para um
  `<Label>` é no-op (o `text-caption` do componente vence). Diferente de `Button`/`Card`, que usam
  `cn()`. Não escrever preview que dependa de sobrescrever tipografia do Label.
- **`p-0.5` / `p-1.5` / `p-2.5` e `gap-*` equivalentes precisaram entrar no safelist**: são valores
  válidos do sub-grid do DS mas nenhum componente atual os usa, então o Tailwind não os emitia — e
  o `conventions.md` os documenta para o agente de design. Regra geral: **todo token citado no
  `conventions.md` tem que existir no `ds.css` compilado**; conferir com
  `grep -F '.<classe>' ds-bundle/_ds_bundle.css` (lembrando de escapar o ponto: `.p-1\.5`).
- **O `planId` do `finalize_plan` não sobrevive a um reset de contexto** — numa sessão longa é
  normal ter que chamar `finalize_plan` de novo no meio do upload. Aprovação nova, mesmo escopo.
- **`localDir` do `finalize_plan` precisa ser caminho absoluto** se o cwd da sessão já tiver mudado
  para dentro de `ds-bundle/` (um `./ds-bundle` relativo vira `ds-bundle/ds-bundle`).
- Resultado desta run: 30/30 componentes, 30 previews autorados (89 células, todas `good`),
  render check limpo (0 bad / 0 thin / 0 variants-identical / 0 floor cards), 4 iterações de build.
