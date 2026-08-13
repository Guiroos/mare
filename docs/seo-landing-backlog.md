# Landing pública e SEO — estado medido e backlog

**Atualizado:** 2026-08-13 (Vercel Web Analytics — §6.2)
**Escopo:** o que foi entregue na construção da landing, o que a medição revelou e o que falta.
**Relação com os outros documentos:** o `PRD-Mare-Lancamento-Publico.md` define as fases e o
racional de aquisição. Este arquivo é o registro técnico: números medidos, achados abertos e
gotchas descobertos na implementação. Onde os dois divergirem sobre estimativa de esforço, este
vence — ele é posterior e baseado em execução, não em previsão.

---

## 1. Entregue

Fase 0 do PRD, completa exceto Search Console e redirect canônico (ambos dependem de acesso a
painel externo, não de código).

| Item | Onde | Observação |
|---|---|---|
| Route group público | `app/(marketing)/` | `/` retorna 200 estático, sem redirect |
| Landing | `app/(marketing)/page.tsx` | hero, 3 diferenciais, features, CTA, FAQ, comparativo |
| Primitivas de marketing | `components/marketing/` | 7 componentes, sem reuso de `components/ui/` |
| Gráfico de maré | `components/marketing/TideChart.tsx` | SVG calculado no servidor, zero JS de cliente |
| Metadata | `app/layout.tsx` | title/description nos limites, OG, Twitter, canonical |
| Imagem OG | `app/opengraph-image.tsx` | 1200×630 gerada no build via `ImageResponse` |
| robots / sitemap | `app/robots.ts`, `app/sitemap.ts` | rotas autenticadas fora; preview fora do índice |
| `noindex` no app | `app/(app)/layout.tsx` | defesa em profundidade sobre o robots.txt |
| Copy de "uso pessoal" | `app/(auth)/login/page.tsx` | removida nos dois pontos (mobile e desktop) |
| Cor de marca unificada | `icon.tsx`, `apple-icon.tsx`, `manifest.ts`, `layout.tsx` | ver §4.1 |
| JSON-LD `FAQPage` | `components/marketing/FaqSection.tsx` | mesma lista alimenta o `<details>` e o schema |
| JSON-LD `SoftwareApplication` + `Organization` + `WebSite` | `components/marketing/StructuredData.tsx` | `@graph` único; sem `aggregateRating` (ver §4.5) |

**Decisão de produto tomada no caminho:** a lista de espera do protótipo foi descartada. O
`BLOCK_SIGNIN` (`lib/auth.ts:49`) já controla abertura de cadastro sem tabela nova, sem envio de
e-mail e sem um passo extra no funil. Os quatro CTAs apontam para `/login`.

---

## 2. Como medir (e por que o número do `npm run dev` não vale)

No dev server o bundle não é minificado, o React roda em modo de desenvolvimento e o HMR injeta
websocket e scripts extras. A nota sai dezenas de pontos abaixo e não descreve nada que o usuário
receba. Sempre medir o build de produção:

```bash
VERCEL_ENV=production npm run build
VERCEL_ENV=production npx next start -p 3102

CHROME_PATH=/usr/bin/chromium npx lighthouse http://localhost:3102/ \
  --output=json --output-path=./lh.json \
  --chrome-flags="--headless=new --no-sandbox --disable-gpu" --quiet
```

**`VERCEL_ENV=production` é obrigatório nas duas linhas.** `robots.ts` e o campo `robots` da
metadata leem `process.env.VERCEL_ENV`, e em rota estática isso é resolvido em **build time**.
Sem a variável no build, o artefato sai com `Disallow: /` e `noindex` gravados — e o Lighthouse
reporta SEO 66 num site que em produção pontua 100. Já custou uma rodada de investigação; na
Vercel a variável existe no build e o comportamento é o correto.

Ressalva de leitura: localhost tem TTFB próximo de zero. Performance e SEO são confiáveis;
qualquer métrica dependente de latência de rede está otimista frente à hospedagem real.

---

## 3. Números medidos

Build de produção, preset mobile do Lighthouse 13.4.1, em `2026-08-11`. A coluna "antes" é a
primeira medição, antes das correções da §4.

| Categoria | Antes | Agora | Alvo do PRD | |
|---|---|---|---|---|
| Performance | 95 | **98** | ≥ 90 | passa |
| Accessibility | 96 | **100** | ≥ 95 | passa |
| Best Practices | 96 | 96 | — | ver §4.4 |
| SEO | 100 | 100 | ≥ 95 | passa |

| Métrica | Antes | Agora | Alvo | |
|---|---|---|---|---|
| First Contentful Paint | 0,9 s | 0,9 s | — | |
| **Largest Contentful Paint** | 2,9 s | **2,3 s** | < 2,5 s | **passa** |
| Cumulative Layout Shift | 0 | 0 | < 0,1 | passa |
| Total Blocking Time | 20 ms | 30 ms | — | passa |
| Speed Index | 0,9 s | 0,9 s | — | |

Peso total: 393 KiB → **274 KiB**. O que saiu:

| Recurso | Antes | Agora | Como |
|---|---|---|---|
| DM Sans (woff2) | 37 KB | 0 | `preload: false`; a landing não usa a fonte do app (§4.2) |
| Ícones | 26 KB ×3 | 2 KB + 8 KB | favicon 32×32 único; o 192 fica só no manifest (§4.3) |
| Archivo (woff2) | 35 KB | 35 KB | fonte variável — tirar o peso 700 não muda o arquivo |
| IBM Plex Mono | 11 KB ×2 | 11 KB ×2 | dois pesos estáticos, ambos usados acima da dobra |

**As quatro linhas da Definition of Done que dependiam de medição agora fecham.** O LCP era o
único alvo em falta e é o que entra no ranqueamento — o score agregado do Lighthouse nunca
substituiu o limiar de Core Web Vitals.

Ressalva de leitura mantida: TTFB de localhost é ~6 ms. O LCP de 2,3 s vem da simulação de 4G do
Lighthouse, não de latência real; na Vercel o TTFB entra por cima. A folga contra o alvo é de
0,2 s, o que é pouco — daí o orçamento de performance no CI continuar valendo (§4.2).

---

## 4. Achados

Ordenados por relação entre impacto e custo. Cada um traz a evidência que o sustenta. Os itens
4.1 a 4.3 estão **resolvidos** — o texto original fica registrado porque é a evidência que
justificou a correção, com a resolução ao fim de cada um.

### 4.1 `--text-tertiary` reprova WCAG AA — e o problema é do DS, não da landing

**Prioridade: alta. Custo: P (1 arquivo), com impacto visual em todo o app. — RESOLVIDO**

Oito elementos da landing reprovam contraste, todos com a mesma causa:

```
--text-tertiary = oklch(66% 0.014 226) = #8a9499
  sobre --bg-base    (#f0f7fa) -> 2,86:1
  sobre --bg-surface (#fbfeff) -> 3,06:1
WCAG AA para texto normal exige 4,5:1
```

O token é usado no app inteiro, não só aqui — a landing só foi a primeira superfície medida. O
menor ajuste que passa nos dois fundos:

```
oklch(54.5% 0.014 226) = #687276  ->  4,55:1 e 4,87:1
```

Para referência, `--text-secondary` (`oklch(48% 0.018 228)`) já dá 6,00:1 e 6,41:1.

Escurecer o token reduz a distância visual entre `text-tertiary` e `text-secondary`, o que é uma
decisão de design, não de acessibilidade. As duas saídas legítimas: escurecer o token (corrige o
app todo) ou reservar `text-tertiary` para uso decorativo e não-textual. Escolher uma; o estado
atual não é nenhuma das duas.

**Cobertura:** `__tests__/unit/focus-ring-contrast.test.ts` já tem toda a maquinaria — converte
OKLCH para sRGB, compõe alpha e calcula razão de contraste — mas só a aplica aos tokens
`--ring-*` contra `--bg-surface`. Estender **esse** arquivo com os pares de texto × fundo é o
caminho, não escrever um novo: a conversão de cor duplicada em dois lugares é como as duas
divergem. O caso precisa incluir `--text-tertiary` sobre `--bg-base` e sobre `--bg-surface` nos
dois temas, com limiar de 4,5:1 — é exatamente o par que a implementação atual reprova, então um
teste que passe hoje não está cobrindo nada.

**Resolvido.** Escolhida a primeira saída: escurecer o token, que corrige o app inteiro.

O tema escuro estava **pior** e o achado original não o media: `--text-tertiary` em `oklch(48%)`
dava 2,83:1 sobre `--bg-surface`. Também não bastava mexer só no terciário — o piso de AA fica em
~52,5% no claro e ~62% no escuro, o que o encostava no `--text-secondary` (48% e 65%). Com 3 a 4
pontos de L de distância os dois níveis viram a mesma cor e a hierarquia de texto deixa de
existir, então o secundário andou junto:

```
claro:   secondary 48% -> 43%    tertiary 66%   -> 52,5%
escuro:  secondary 65% -> 70%    tertiary 48%   -> 62%
```

Não existe combinação que passe AA e preserve o degrau original de 18 pontos de L: o piso não
deixa. O `--bg-muted` ficou de fora do gate de propósito — nem 4,5:1 é alcançável ali com um
terciário ainda distinguível do secundário, e a regra passa a ser não usar texto terciário nesse
fundo (registrada em comentário no `globals.css`).

`__tests__/unit/focus-ring-contrast.test.ts` ganhou o gate: 18 casos (3 tokens de texto × 3 fundos
× 2 temas) com limiar de 4,5:1, na mesma maquinaria de conversão OKLCH→sRGB do gate de anel de
foco. Os quatro pares que a implementação anterior reprovava estão entre eles. Lighthouse
Accessibility foi de 96 para 100, com zero elementos em `color-contrast`.

### 4.2 LCP mobile em 2,9 s contra alvo de 2,5 s

**Prioridade: alta. Custo: M (2–4 arquivos). — RESOLVIDO**

FCP em 0,9 s e LCP em 2,9 s: o primeiro pixel chega rápido, o elemento principal demora 2 s a
mais. Duas causas prováveis, ambas mensuráveis antes de mexer:

**a) Providers de cliente herdados do root layout.** O `app/layout.tsx` monta `ThemeProvider`,
`Toaster` (sonner), `NextTopLoader` e `SpeedInsights` para **todas** as rotas. A landing não usa
nenhum dos quatro, e são ~100 KB de JS de cliente em dois chunks. Mover os providers para
`(app)/layout.tsx` e `(auth)/layout.tsx` tiraria isso do caminho da landing.

Atenção ao efeito colateral: o `next-themes` grava a classe no `<html>`. Movendo o provider para
baixo, navegação client-side de `(app)` para `(marketing)` pode deixar a classe `dark` obsoleta
no elemento raiz. Hoje isso é inofensivo porque a landing força `theme-light` (§5.2), mas a
interação precisa ser verificada, não assumida.

**b) 72 KB de fonte em duas famílias.** Archivo e IBM Plex Mono, ambas usadas acima da dobra.
Reduzir o Archivo aos pesos realmente usados (400 e 600) e checar se o Plex Mono precisa mesmo
carregar antes da dobra — ele só serve os eyebrows e os rótulos do gráfico.

Também aparece: 27 KiB de JS não utilizado e um CSS bloqueante de 12,4 KB custando 158 ms.

**Cobertura:** um orçamento de performance no CI (Lighthouse CI com limiar de LCP) é o que
impede a recaída. Sem isso, o próximo componente pesado na landing passa despercebido.

**Resolvido — mas nenhuma das duas causas prováveis era a principal.** Vale registrar porque as
duas hipóteses acima estavam escritas com confiança e as duas renderam quase nada:

- **(a) providers de cliente.** Movidos para `(app)/layout.tsx` e `(auth)/layout.tsx`, com o
  `ThemeProvider` repetido no de auth porque `/login` precisa dele para respeitar o tema. O LCP
  saiu de 2,9 s para **3,0 s** — dentro do ruído. O JS nunca esteve no caminho crítico: a landing
  não tem hidratação bloqueante e o TBT já era 20 ms. A mudança fica porque é correta (a landing
  não deve carregar provider que não usa) e porque baixou o peso total, não porque moveu o LCP.
- **(b) pesos de fonte.** O Archivo é **fonte variável** no `next/font`: tirar o peso 700 não muda
  um byte, porque o arquivo é um só e cobre a faixa inteira. A declaração foi enxugada para os
  pesos realmente usados (400/500/600) — o ganho é impedir que alguém escreva `font-bold` e receba
  negrito sintetizado, não tamanho. A IBM Plex Mono é a exceção: **não tem versão variável** e sai
  em dois woff2 estáticos (400 e 500, ~10 KB cada), ambos com preload na landing. Ali o array de
  pesos é peso de verdade — se um dos dois deixar de ser usado acima da dobra, o corte rende bytes.

**A causa real era o preload do `next/font`, que é por documento e não por rota.** O DM Sans
(37,9 KB) era pré-carregado em toda visita à landing — que não usa a fonte do app em elemento
nenhum — e disputava banda justamente com o Archivo, que desenha o LCP (o elemento é o parágrafo
do hero, `p.mt-5`). `preload: false` no DM Sans levou o LCP de 3,0 s para **2,3 s** e a nota de
Performance de 95 para 98, numa linha. O app continua recebendo a fonte, descoberta pelo CSS; o
app é `noindex`, então LCP lá não é ranqueado.

A recomendação de orçamento no CI **continua aberta e ficou mais necessária**, não menos: a folga
contra o alvo é de 0,2 s, e um `preload` reintroduzido por descuido gasta ela inteira sem
aparecer em nenhum gate.

### 4.3 Três requisições de ícone na landing, 78 KB

**Prioridade: média. Custo: P. — RESOLVIDO**

`/icon/sm`, `/icon/md` e `/icon/md?…` são buscados no carregamento da landing, 26 KB cada. São
PNGs gerados por `ImageResponse` sem otimização de paleta — um ícone de 32×32 não deveria passar
de poucos KB. A duplicata de `/icon/md` (com e sem query) sugere que manifest e link de favicon
apontam para variantes que não colidem em cache.

**Resolvido.** A causa é que o Next emite um `<link rel="icon">` por entrada de
`generateImageMetadata` — declarar `sm`, `md` e `lg` no `app/icon.tsx` colocava os três no HTML,
e o Chrome baixava os três. A duplicata de `/icon/md` era a hipótese confirmada: o `<link>` tem
query de hash, o manifest não, e nenhum dos dois acerta o cache do outro.

`app/icon.tsx` passou a declarar só o 32×32. Os tamanhos de PWA saíram para
`app/icons/[name]/route.tsx` (`force-static` + `generateStaticParams`, pré-renderizados no build),
referenciados apenas pelo manifest — só são buscados na instalação. O desenho da onda foi extraído
para `app/_icon/render.tsx`, compartilhado pelas três superfícies: era a duplicação de exatamente
esse trecho que deixou o `#1a78c4` sobreviver em uns arquivos e não em outros (§5.3). Ao unificar
apareceu um bug de sobra: o `app/icon.tsx` somava `marginTop` de centralização sobre um flex que
já centrava, e o favicon saía deslocado para baixo em relação ao ícone iOS.

Favicon: 26 KB → **2,1 KB**. O `/icons/192` ainda é buscado (8,6 KB), pelo manifest, fora do
caminho crítico — o Chrome o quer para o prompt de instalação.

### 4.4 Erros de console: Vercel Speed Insights

**Prioridade: nenhuma — não é bug.**

`/_vercel/speed-insights/script.js` retorna 404 fora da Vercel, e o Chrome recusa executar por
MIME type. É o único motivo de Best Practices ser 96 em vez de 100. Resolve sozinho em produção.
Registrado aqui para que a próxima medição não gaste tempo investigando.

### 4.5 Achados desta rodada — três bugs de metadata que nenhuma nota acusava

**Todos resolvidos. Custo: P.** Ficam registrados porque a lição é comum aos três: Lighthouse dá
100 em SEO com metadata que aponta para o lugar errado. Ele verifica presença, não destino.

**`twitter:image` apontava para um arquivo inexistente.** `app/layout.tsx` declarava
`twitter: { images: ['/og.png'] }`, e `/og.png` não existe — nem em `public/`, nem como rota. Pior
que ausente: o campo **sobrescrevia** a imagem gerada por `app/opengraph-image.tsx`, então o card
do X ia para um 404 enquanto WhatsApp e Telegram (que leem `og:image`) mostravam a imagem certa.
O critério de aceite T0.2 do PRD pede validação nos três, o que teria pego — mas nenhum gate
automático pega, porque o `<meta>` está lá e é sintaticamente válido. Removido o campo: o Next
preenche `twitter:image` a partir do `opengraph-image` sozinho (conferido no HTML do build).

**`alternates: { canonical: '/' }` estava no root layout.** Metadata do root é herdada por todas as
rotas, então cada página do app declarava `/` como sua canônica — o oposto exato do que um
canonical serve para fazer. Hoje o impacto é contido porque `(app)` é `noindex`, mas a primeira
rota pública nova (`/privacidade`, `/termos`, `/seguranca`, blog) herdaria e se anularia. Movido
para as páginas; a landing já declarava a sua.

**O domínio canônico estava escrito em três arquivos.** `app/layout.tsx`, `app/robots.ts` e
`app/sitemap.ts` repetiam `https://meumare.com.br` sem nada forçando concordância — divergência
ali não quebra build, só gera sitemap apontando para um host e canonical para outro. Extraído para
`lib/utils/site.ts`.

**Schema markup (T1.3) estava pela metade.** O `FAQPage` existia; faltavam
`SoftwareApplication`, `Organization` e `WebSite`, que é o item que o PRD chama de "uma das poucas
formas realistas de ganhar espaço no SERP sem autoridade de domínio". Adicionados em
`components/marketing/StructuredData.tsx`, num `@graph` único para que o app referencie a
organização por `@id` em vez de repetir os campos dela.

Deliberadamente **sem `aggregateRating` nem `review`**: são o que renderiza estrelas no SERP e a
tentação óbvia, mas o Maré não tem avaliação pública nenhuma — seria dado inventado, e é
exatamente a classe de marcação que rende manual action do Google. Validar no Rich Results Test
assim que o domínio estiver no ar (linha aberta na Definition of Done).

---

### 4.6 Achados da revisão do PR — o que nenhuma medição pegaria

**Resolvidos. Custo: P.** Os dois têm em comum não aparecer em gate nenhum: um é uma classe que o
Tailwind simplesmente descarta, o outro só se manifesta num dispositivo Android real.

**`pt-4.5` não existe e some em silêncio.** `app/(marketing)/page.tsx` usava `pt-4.5` nos quatro
cards de "Também vem junto". A escala de spacing do Tailwind 3.4 tem `3.5` mas não `4.5`, e a
config do projeto não estende — compilando o CSS com a classe no conteúdo saem **zero** regras
(`mt-3.5`, como controle, sai uma). Os cards ficavam colados na `border-t`. Trocado por `pt-5`.
O modo de falha é o que interessa: classe inexistente não é erro de build nem de lint, o layout só
fica um pouco errado. Um `grep -nE '\b[a-z-]+-(4|5|6|7|8|9|1[0-2])\.5\b'` sobre a landing devolve
zero hoje e é a checagem barata para a próxima vez.

**`purpose: 'maskable'` num ícone que não é maskable.** O manifest declarava o 512 como maskable,
mas ele é o mesmo desenho do favicon: `borderRadius` (cantos transparentes, que o Android preenche
por conta própria) e a onda ocupando 86% da largura, bem fora da área segura de 80% que a
especificação reserva. No recorte circular as pontas da onda somem. Não era regressão deste PR,
mas o PR reescreveu o renderizador — com `renderIcon(dim, maskable)` a variante custa um
parâmetro: fundo sangrando até a borda e onda a 56% da largura (meia-diagonal de 0,344·dim contra
raio de 0,4·dim, com folga). Foi para uma entrada própria em vez de `purpose: 'any maskable'` no
512 porque o desenho é outro, não o mesmo arquivo com dois papéis. A rota virou `app/icons/[name]`
— o nome carrega o propósito, não só o tamanho.

## 5. Gotchas descobertos na implementação

Custaram tempo real e não estão documentados em lugar nenhum do repo.

### 5.1 `ImageResponse` / Satori

- **`oklch()` não é suportado.** Todos os tokens precisam entrar como hex convertido. O conversor
  usado está validado contra `#ff0000`, `#ffffff` e `#0000ff`; os valores estão em
  `app/opengraph-image.tsx`.
- **`fetch(new URL('./arquivo', import.meta.url))`** — o padrão da documentação do Next para
  carregar fontes — falha no build com `not implemented... yet...`. Usar `readFile` de
  `node:fs/promises`, que funciona porque a rota é pré-renderizada.
- **`gap` e `marginRight` entre `<span>` são ignorados**, e espaço comum no fim de um span é
  aparado. Só `U+00A0` dentro do texto sobrevive.
- **Glifo fora do subset da fonte some sem erro de build.** Foi assim que duas palavras
  apareceram coladas na primeira versão do OG. Ao mudar qualquer texto de
  `app/opengraph-image.tsx`, re-subsetar `app/_og-fonts/`.

### 5.2 Landing light-only

O brief pede a landing em light-only, mas o grupo `(marketing)` herdava o dark mode do app pelo
`ThemeProvider` do root layout — e a paleta de marketing não foi calibrada para fundo escuro:
em dark reprovava seis elementos de contraste.

Resolvido com a classe `.theme-light` em `app/globals.css`, que repete o seletor do bloco de
tokens (não os valores) para manter uma subárvore clara mesmo com `.dark` no `<html>`, mais
`[color-scheme:light]` no wrapper de `app/(marketing)/layout.tsx`.

### 5.3 `#1a78c4` não era o azul da marca

`icon.tsx`, `apple-icon.tsx`, `manifest.ts` e o `themeColor` usavam `#1a78c4`, que é
`oklch(56% 0.143 249)` — matiz diferente do token `--accent` (`oklch(50% 0.14 230)` = `#006fa3`)
que a interface renderiza. O ícone na tela de início era de um azul inexistente no produto. Os
quatro foram alinhados ao token.

Desde então o desenho do ícone virou `app/_icon/render.tsx`, compartilhado pelas três superfícies
— era a cópia colada em três arquivos que permitiu a divergência em primeiro lugar.

Duas ocorrências permanecem, de propósito:

- `lib/db/migrations/0007_*.sql` — migration histórica, não se edita.
- `lib/utils/color.ts:11` (`DEFAULT_INVESTMENT_TYPE_COLOR`) — é cor de dado, não de marca: muda
  o visual de gráficos de usuários existentes e teria de vir junto com
  `DEFAULT_INVESTMENT_TYPE_BG_COLOR`. Decisão de produto, ainda em aberto.

### 5.4 CSP bloqueia recursos externos

`next.config.mjs` declara `font-src 'self'` e `script-src 'self' … va.vercel-scripts.com`. O
`<link>` para `fonts.gstatic.com` do protótipo seria bloqueado em produção — por isso as fontes
são self-hospedadas via `next/font`. **Qualquer analytics de terceiro (Plausible, PostHog) exige
liberar o domínio em `script-src` e `connect-src` antes**, senão quebra em silêncio.

### 5.5 `next/font`: preload é por documento, não por rota

Fonte declarada no root layout com `preload` (o padrão) vira `<link rel="preload">` em **toda**
página do site, mesmo nas que não usam nenhum glifo dela. Foi o que segurou o LCP da landing em
2,9 s (§4.2). Regra: fonte que não é usada na rota crítica vai com `preload: false`.

Corolário que economiza uma investigação, com a ressalva que a primeira redação desta seção errou:
**Archivo e DM Sans chegam como fontes variáveis** — um arquivo cobre a faixa inteira de pesos, e
enxugar o array `weight` não reduz um byte; serve só para impedir peso sintetizado. **A IBM Plex
Mono não tem versão variável no Google Fonts**: os dois pesos declarados viram dois woff2 de
~10 KB, conforme a tabela da §3 sempre mostrou. A regra correta é conferir a família antes de
supor: para as variáveis, cortar bytes exige cortar famílias ou subsets; para as estáticas,
cortar peso funciona.

### 5.6 `generateImageMetadata` emite um `<link>` por entrada

Cada item devolvido por `generateImageMetadata` em `app/icon.tsx` vira uma tag no `<head>`, e o
navegador baixa todas — não só a que vai usar. Ícone de PWA não pertence a esse arquivo: vai em
rota própria referenciada só pelo manifest (§4.3).

### 5.7 `ds-reviewer` e `components/marketing/`

O hook `post-edit-ds-review.sh` foi ajustado para ignorar `components/marketing/` e
`app/(marketing)/`. A landing tem primitivas próprias por decisão de brief, e o agente as
reprovaria por construção.

---

## 6. Falta para lançar

Nada aqui é otimização de SEO ou de performance: a §4 está fechada e as quatro metas de medição do
PRD passam. O que resta é conteúdo (páginas legais), funcionalidade de produto (exportação,
exclusão de conta), acesso a painel externo (DNS, Search Console) e um número que ninguém mediu.

### 6.1 Bloqueiam abrir cadastro público

Todos da Fase 0.5 do PRD. **Esta é a lista canônica do que falta** — se um item não está aqui, ele
não está pendente em lugar nenhum.

Os dois em negrito são de outra classe: a landing **já afirma** que existem. Não é escopo futuro,
é declaração falsa em produção. Os pontos exatos estão marcados no código com o comentário
`PROMESSA SEM LASTRO`, que aponta de volta para cá — `grep -rn "PROMESSA SEM LASTRO"` devolve os
dois.

| Item | Estado | O que falta | Onde a landing já promete |
| --- | --- | --- | --- |
| Política de Privacidade | não existe | `app/(marketing)/privacidade/` | — (o rodapé está sem links por isso) |
| Termos de Uso | não existe | `app/(marketing)/termos/` | — |
| Página de Segurança | não existe | `app/(marketing)/seguranca/` | — (sustenta a cunha "sem conexão bancária") |
| **Exportação completa** | **parcial** | existem `/api/export/extrato` e `/api/export/devedores`; faltam investimentos, metas, parcelas, categorias e contas | `FaqSection.tsx` ("exportar tudo em CSV") e o card "Seus dados são seus" em `app/(marketing)/page.tsx` |
| **Exclusão de conta** | **não existe** | `lib/actions/reset-account.ts` limpa os dados e **mantém** o usuário — é outra coisa; a ordem de FK de lá é reaproveitável | `FaqSection.tsx` ("apagar sua conta a qualquer momento") e o mesmo card |

Enquanto os dois de negrito não subirem existem duas saídas legítimas, e **o estado atual não é
nenhuma das duas**: implementar, ou suavizar a copy nos dois pontos marcados. Suavizar custa duas
frases, mas é decisão de produto — a promessa é parte da cunha "seus dados são seus", que é
justamente o diferencial da Fase 2 do PRD.

Ao subir as três páginas, restaurar os links no `MarketingFooter` (há comentário marcando o ponto)
e acrescentá-las ao `app/sitemap.ts`.

### 6.2 Infra

- Redirect `www` → apex em salto único. Aceite: `curl -sIL https://www.meumare.com.br` com no
  máximo um 308 antes do 200.
- Google Search Console verificado e sitemap submetido. O histórico só começa na verificação —
  cada semana de atraso é perda permanente.
- ~~Analytics: escolher a ferramenta **e** liberar o domínio na CSP (§5.4).~~ **Resolvido:**
  Vercel Web Analytics (`@vercel/analytics@2.0.1`), montado por route group — `(marketing)`,
  `(auth)` e `(app)` sim, `(share)` **não**, pelo mesmo motivo que o `SpeedInsights` (§6.2.1).
  A CSP não precisou de mudança nenhuma: o v2 carrega de um caminho same-origin
  (`/<unique-path>/script.js`, coberto por `'self'`) e o fallback já era `va.vercel-scripts.com`,
  liberado em `script-src` e `connect-src` desde o Speed Insights. A ressalva do §5.4 continua
  valendo para analytics de **terceiro** (Plausible, PostHog, GA) — Vercel é a exceção porque é
  same-origin.

#### 6.2.1 Por que o Analytics é montado por grupo, e não no root

Mesma razão do `SpeedInsights`: o evento carrega a URL **concreta** (`BeforeSendEvent.url`, campo
distinto do `route`, que traz só o padrão), e `/e/<token>` tem a credencial no path. Montar na raiz
mandaria o token de todo extrato compartilhado para o dashboard da Vercel.

A alternativa seria montar na raiz com `beforeSend` derrubando `/e/*`, e ela foi descartada:
`beforeSend` é prop de função e não atravessa a fronteira RSC, então exigiria um Client Component
novo só para carregá-la — mais código para o mesmo resultado que a montagem por grupo já dá.

`(auth)` recebe `Analytics` mas não `SpeedInsights`: `/login` é o passo de conversão do funil que
começa na landing, então a pageview importa; o Core Web Vitals não, porque a rota é `noindex`.

Verificação no build (`VERCEL_ENV=production npm run build`), contando ocorrências em
`.next/server/app/**/page_client-reference-manifest.js`:

| Rota | `@vercel/analytics` | `@vercel/speed-insights` |
| --- | --- | --- |
| `(marketing)/page` | 1 | 1 |
| `(auth)/login/page` | 1 | 0 |
| `(app)/dashboard/page` | 1 | 1 |
| `(share)/e/[token]/page` | **0** | **0** |

**O que o Web Analytics não resolve:** o gate da §6.3. Ele não faz coorte de retenção, e no plano
Hobby a janela de relatório é de 1 mês — D30 é impossível de ler ali. O que ele entrega é o funil
de aquisição (visitas na landing, referrer, país, dispositivo, cliques para `/login`). Retenção
continua sendo a query em `transactions.createdAt`.

**Limites do Hobby:** 50.000 eventos/mês, janela de 1 mês, sem custom events (`track()` exige Pro).
Ao estourar, a coleta pausa após 3 dias de carência — não há cobrança surpresa.

### 6.3 O gate que continua aberto

A retenção D30 dos betas nunca foi medida. O PRD a coloca como condição de lançamento e o próprio
documento diz que crescer aquisição antes de resolver retenção é furar o balde e abrir mais a
torneira.

Não depende de instrumentar analytics nem de esperar 30 dias: os dados já estão no banco.
Agrupar `transactions.createdAt` por `userId` dá retenção retroativa em cerca de uma hora. É a
única tarefa desta lista que pode concluir que o resto não deve ser feito ainda — e o custo de
descobrir isso tarde subiu agora que a landing existe.

---

## 7. Fora de escopo declarado

Registrado para não voltar como pergunta:

- Dark mode na landing — light-only por decisão de brief; os tokens existem, adicionar depois é barato
- App nativo, Open Finance, monetização, afiliados — não-objetivos do PRD
- Importação de planilha — o FAQ responde "hoje não", sem prometer data
