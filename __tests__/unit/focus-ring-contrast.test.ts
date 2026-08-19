import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Gate de contraste do anel de foco (WCAG 2.2 1.4.11 — issue #52). `--ring-*`
// em app/globals.css é `oklch(L% C H / A)`; convertido para sRGB, composto
// sobre `--bg-surface` pelo alpha, e comparado — precisa alcançar >= 3:1 nos
// dois temas. Um teste que só checasse a presença da string `focus:` no
// componente passaria com esse contraste ainda abaixo do mínimo.

const CSS_PATH = join(process.cwd(), 'app/globals.css')

type Rgb = [number, number, number]

function oklchToLinearSrgb(l: number, c: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b
  const ll = l_ ** 3
  const mm = m_ ** 3
  const ss = s_ ** 3
  return [
    4.0767416621 * ll - 3.3077115913 * mm + 0.2309699292 * ss,
    -1.2684380046 * ll + 2.6097574011 * mm - 0.3413193965 * ss,
    -0.0041960863 * ll - 0.7034186147 * mm + 1.707614701 * ss,
  ]
}

function gamma(c: number): number {
  const clamped = Math.min(1, Math.max(0, c))
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055
}

function oklchToSrgb255(l: number, c: number, h: number): Rgb {
  const linear = oklchToLinearSrgb(l, c, h)
  return linear.map((v) => Math.round(gamma(v) * 255)) as Rgb
}

function relativeLuminance([r, g, b]: Rgb): number {
  const lin = (channel: number) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [lighter, darker] = la > lb ? [la, lb] : [lb, la]
  return (lighter + 0.05) / (darker + 0.05)
}

function composite(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return fg.map((channel, i) => Math.round(channel * alpha + bg[i] * (1 - alpha))) as Rgb
}

function extractOklch(cssBlock: string, varName: string) {
  const re = new RegExp(
    `--${varName}:\\s*oklch\\(([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)(?:\\s*/\\s*([\\d.]+))?\\)`
  )
  const match = cssBlock.match(re)
  if (!match) {
    throw new Error(`Token --${varName} não encontrado (ou não é oklch(...)) no bloco fornecido`)
  }
  const [, l, c, h, a] = match
  return { l: Number(l) / 100, c: Number(c), h: Number(h), a: a === undefined ? 1 : Number(a) }
}

function solidRgb(block: string, token: string): Rgb {
  const { l, c, h } = extractOklch(block, token)
  return oklchToSrgb255(l, c, h)
}

function textContrast(block: string, textToken: string, bgToken: string): number {
  return contrastRatio(solidRgb(block, textToken), solidRgb(block, bgToken))
}

function contrastAgainstSurface(block: string, ringToken: string): number {
  const surface = extractOklch(block, 'bg-surface')
  const ring = extractOklch(block, ringToken)
  const surfaceRgb = oklchToSrgb255(surface.l, surface.c, surface.h)
  const ringRgb = oklchToSrgb255(ring.l, ring.c, ring.h)
  const composited = composite(ringRgb, ring.a, surfaceRgb)
  return contrastRatio(composited, surfaceRgb)
}

const css = readFileSync(CSS_PATH, 'utf-8')
// `[^{]*` cobre seletores adicionais na mesma regra (hoje `:root, .theme-light`,
// usado pela landing para permanecer clara sob `.dark`). Casar `:root {` literal
// quebra o teste a cada seletor novo, sem que nada de contraste tenha mudado.
const rootBlock = css.match(/:root[^{]*\{([^}]*)\}/)?.[1]
const darkBlock = css.match(/\.dark\s*\{([^}]*)\}/)?.[1]
if (!rootBlock || !darkBlock) {
  throw new Error('Não encontrei os blocos :root/.dark em app/globals.css')
}

describe('anel de foco — contraste WCAG 1.4.11', () => {
  it.each([
    ['claro', rootBlock, 'ring-accent'],
    ['claro', rootBlock, 'ring-negative'],
    ['escuro', darkBlock, 'ring-accent'],
    ['escuro', darkBlock, 'ring-negative'],
  ] as const)('%s: --%s composto sobre --bg-surface atinge >= 3:1', (_theme, block, token) => {
    expect(contrastAgainstSurface(block, token)).toBeGreaterThanOrEqual(3)
  })
})

// Texto contra fundo é WCAG 1.4.3 (4,5:1 para texto normal), gate distinto do
// anel de foco acima — mas a mesma maquinaria de conversão de cor. Estender
// este arquivo em vez de criar outro é deliberado: duas implementações de
// OKLCH→sRGB no repo é como as duas divergem e uma delas passa a mentir.
//
// `--text-tertiary` reprovava nos dois temas (2,86:1 sobre --bg-base no claro,
// 2,83:1 sobre --bg-surface no escuro) — é justamente o par que a implementação
// anterior falhava, então um caso que passasse antes da correção não cobriria
// nada. `--bg-muted` fica fora de propósito: nenhum dos tokens de texto
// secundário/terciário alcança 4,5:1 sobre ele, e a regra registrada é não usar
// texto terciário nesse fundo.
const TEXT_BACKGROUNDS = ['bg-base', 'bg-surface', 'bg-subtle'] as const
const TEXT_TOKENS = ['text-primary', 'text-secondary', 'text-tertiary'] as const

describe('texto — contraste WCAG 1.4.3', () => {
  it.each(
    (['claro', 'escuro'] as const).flatMap((theme) =>
      TEXT_TOKENS.flatMap((text) =>
        TEXT_BACKGROUNDS.map(
          // O bloco de CSS vai no fim da tupla porque `%s` do vitest consome os
          // argumentos em ordem — com ele antes, o título do teste imprimiria
          // o arquivo inteiro.
          (bg) => [theme, text, bg, theme === 'claro' ? rootBlock : darkBlock] as const
        )
      )
    )
  )('%s: --%s sobre --%s atinge >= 4.5:1', (_theme, text, bg, block) => {
    expect(textContrast(block, text, bg)).toBeGreaterThanOrEqual(4.5)
  })
})

// Cores semânticas sólidas (--positive/--negative/--warning) só tinham valor
// único no :root — o .dark não redefinia nenhuma, herdando o par calibrado
// para fundo claro (issue #76). Os seis pares abaixo são exatamente os que
// reprovavam antes da correção: uma tabela genérica de "toda cor x todo
// fundo" incluiria dezenas de pares que já passavam e não pegaria o furo.
//
// issue #94 — --negative/--positive sobre --bg-subtle no escuro seguem
// abaixo de 4,5:1 (4,05:1 e 4,03:1). Subir os dois tokens fecharia o par mas
// muda o vermelho/verde de valores no app inteiro — decisão de design fora
// de escopo de correção pontual. O site mais caro (painéis "Ação
// irreversível" de Resetar/Excluir conta em SettingsDialog.tsx — estático,
// não hover) foi corrigido trocando o FUNDO do painel de --bg-subtle para
// --negative-subtle em vez de subir o token: 4,54:1, coberto pelo caso
// negative/negative-subtle abaixo. --positive não tem site estático
// conhecido e TransactionList.tsx/WithdrawalTable.tsx (hover da linha
// inteira, não só do valor) continuam sem cobertura — ver issue #94.
describe('cores semânticas sólidas — contraste WCAG 1.4.3', () => {
  it.each([
    ['escuro', 'negative', 'bg-surface', darkBlock],
    ['escuro', 'positive', 'bg-surface', darkBlock],
    ['claro', 'positive', 'bg-base', rootBlock],
    ['claro', 'warning', 'bg-surface', rootBlock],
    ['escuro', 'negative', 'negative-subtle', darkBlock],
    ['claro', 'negative', 'negative-subtle', rootBlock],
  ] as const)('%s: --%s sobre --%s atinge >= 4.5:1', (_theme, text, bg, block) => {
    expect(textContrast(block, text, bg)).toBeGreaterThanOrEqual(4.5)
  })

  // --accent/--positive/--negative/--warning também são usados como FUNDO com
  // texto claro por cima (Button primary/positive/danger:hover, botões
  // !bg-warning !text-text-inverse) — o token sólido puxa os dois papéis em
  // direções opostas, e textContrast() acima assume dois tokens de CSS, não
  // um par cor-fixa x token. Composto manualmente aqui.
  //
  // Inclui os tokens -hover de Button primary/positive: a revisão do PR #93
  // pegou que o gate original só cobria o estado de repouso — no escuro,
  // --accent-hover/--positive-hover continuavam mais ESCUROS que o base
  // (convenção herdada do tema claro, onde funcionava com texto branco) e
  // reprovavam assim que o texto por cima virou --text-inverse (quase-preto).
  // Testar os dois temas em cada token, não só o que reprovava antes da
  // correção: --accent-hover e --positive-hover do claro não mudaram nesta
  // PR, mas como o texto por cima deles mudou (branco -> text-inverse em
  // `positive`), regressão futura só nesse par também precisa de gate.
  it.each([
    ['escuro', 'accent', darkBlock],
    ['claro', 'warning', rootBlock],
    ['escuro', 'positive', darkBlock],
    ['claro', 'positive', rootBlock],
    ['escuro', 'negative', darkBlock],
    ['claro', 'negative', rootBlock],
    ['escuro', 'accent-hover', darkBlock],
    ['claro', 'accent-hover', rootBlock],
    ['escuro', 'positive-hover', darkBlock],
    ['claro', 'positive-hover', rootBlock],
  ] as const)('%s: --text-inverse sobre --%s (fundo) atinge >= 4.5:1', (_theme, bgToken, block) => {
    const inverse = solidRgb(block, 'text-inverse')
    const bg = solidRgb(block, bgToken)
    expect(contrastRatio(inverse, bg)).toBeGreaterThanOrEqual(4.5)
  })
})

// O gate acima só cobre o token — sozinho, não pega alguém apagando o
// `focus-visible:` do Button ou reintroduzindo `focus:shadow-none` no
// HeroAmountCard com o CSS intacto. As duas juntas fecham as duas metades
// do bug da issue #52 (ver review no PR #69).
describe('anel de foco — indicador não suprimido nos componentes', () => {
  it('button.tsx devolve indicador de foco no base', () => {
    const btn = readFileSync(join(process.cwd(), 'components/ui/button.tsx'), 'utf-8')
    expect(btn).toMatch(/focus-visible:shadow-\[0_0_0_3px_var\(--ring-accent\)\]/)
  })

  it('HeroAmountCard não suprime o anel herdado do inputBase', () => {
    const hero = readFileSync(
      join(process.cwd(), 'components/forms/transaction/HeroAmountCard.tsx'),
      'utf-8'
    )
    expect(hero).not.toMatch(/focus:shadow-none/)
  })

  // issue #77 — item de menu Radix com outline-none e só hover:, sem focus:
  // nem data-[highlighted]:; o Radix move o foco de DOM para o item
  // (MenuItemImpl chama item.focus()), então hover sozinho não cobre teclado.
  it('multiselect-dropdown.tsx devolve indicador de foco no item de menu', () => {
    const md = readFileSync(join(process.cwd(), 'components/ui/multiselect-dropdown.tsx'), 'utf-8')
    expect(md).toMatch(/focus:bg-bg-subtle|data-\[highlighted\]:bg-bg-subtle/)
  })

  // Ancorado no ramo `cursor-pointer` (não desabilitado) do `itemCls`, e não
  // no arquivo inteiro: a #77 já previu que o erro mais provável seria pôr o
  // `focus:` na string base compartilhada pelos dois ramos, o que realçaria
  // também o item `disabled`. Um `toMatch` sobre o arquivo inteiro aceitaria
  // essa implementação errada; ancorar na linha do ramo habilitado não.
  it('ExportButton.tsx devolve indicador de foco só no item habilitado', () => {
    const eb = readFileSync(join(process.cwd(), 'components/export/ExportButton.tsx'), 'utf-8')
    expect(eb).toMatch(/cursor-pointer text-text-primary hover:bg-bg-subtle focus:bg-bg-subtle/)
  })

  // issue #77 — o input do Switch é 0x0/opacity-0 e a trilha visível não reage
  // a foco nenhum. Uma asserção genérica por /focus/ passaria com o bug
  // intacto (o arquivo ganharia a palavra com focus: no próprio input
  // invisível); peer-focus-visible: só é satisfeito pela correção que
  // estiliza a trilha.
  it('switch.tsx devolve indicador de foco na trilha visível', () => {
    const sw = readFileSync(join(process.cwd(), 'components/ui/switch.tsx'), 'utf-8')
    expect(sw).toMatch(/peer-focus-visible:/)
  })

  // Review do PR #99 — `disabled` era desestruturado só para pintar o
  // `<label>` (`pointer-events-none opacity-50`) e nunca chegava ao `<input>`.
  // Antes deste PR era um bug silencioso (input invisível, ninguém via o foco
  // pousar ali); com `peer-focus-visible:` acima, um switch "desabilitado" na
  // tela continua no tab order, continua alternável por Espaço, e o anel de
  // foco herda a opacity-50 do label — abaixo do contraste que este arquivo
  // de teste existe para defender. Ancorado em `disabled={disabled}` e não em
  // `/disabled/` genérico: a palavra já aparece hoje na desestruturação e na
  // className, então um regex solto passaria com o bug intacto.
  it('switch.tsx propaga disabled para o input, não só para o label', () => {
    const sw = readFileSync(join(process.cwd(), 'components/ui/switch.tsx'), 'utf-8')
    expect(sw).toMatch(/disabled=\{disabled\}/)
  })
})

// WCAG 4.1.2 (issue #75) — o Combobox não tem nenhum papel ARIA e a navegação
// por setas não move o foco de DOM, então sem aria-activedescendant não há o
// que um leitor de tela anuncie. jsx-a11y não pega: as regras de role só
// disparam quando um role já existe, e aqui a ausência total é o próprio bug.
// Os sete casos abaixo falham na implementação anterior e só passam com a
// correção — nenhum é satisfeito por acidente.
describe('Combobox — papel e estado ARIA (WCAG 4.1.2)', () => {
  const combobox = readFileSync(join(process.cwd(), 'components/ui/combobox.tsx'), 'utf-8')

  it.each([
    /role="combobox"/,
    /aria-expanded=/,
    /aria-controls=/,
    /aria-activedescendant=/,
    /role="listbox"/,
    /role="option"/,
    /aria-selected=/,
  ])('expõe %s', (hook) => {
    expect(combobox).toMatch(hook)
  })
})
