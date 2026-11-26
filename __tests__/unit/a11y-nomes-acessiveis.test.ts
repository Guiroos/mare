import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

// ─── Botões só de ícone sem nome acessível (#106) ──────────────────────────
//
// `lucide-react@1.8.0` (package.json:45) marca o <svg> do ícone como
// `aria-hidden="true"` quando ele não recebe filho nem prop de a11y — então
// um <Button size="icon"> cujo único filho é um ícone chega ao leitor de tela
// como `role=button name=""`. Não há infra de render de componente no projeto
// (sem jsdom/testing-library); o gate possível é sobre o texto-fonte, padrão
// já usado em row-actions.test.ts (#54) e a11y-estado-selecao.test.ts (#107).
//
// A asserção precisa ancorar no <Button> que envolve o ícone, não no arquivo
// inteiro — senão um aria-label em qualquer outro botão do mesmo arquivo
// deixaria o teste verde com o gatilho ainda sem nome.

function findButtonsWithIcon(source: string, iconTag: string): string[] {
  // Ancora no <Button> MAIS PRÓXIMO do ícone: a lookahead negativa impede o
  // match de atravessar outro "<Button" antes de alcançar o ícone-alvo — sem
  // isso um regex guloso/lazy simples poderia casar a partir de um <Button>
  // anterior no mesmo arquivo, desde que os marcadores (onClick, ícone,
  // </Button>) só existam depois dele. A barreira `(?!<\/Button>)` fecha o
  // outro lado: impede a fatia de atravessar um fechamento e ancorar num botão
  // já encerrado quando o ícone não está dentro de <Button> nenhum.
  //
  // Devolve TODOS os recortes, não o primeiro: um `match` não-global mediria
  // só o primeiro gatilho e deixaria qualquer ícone seguinte descoberto em
  // silêncio, que é o modo de falha que o gate do SplitSection (abaixo) já
  // existia para impedir.
  //
  // Para no início da tag do ícone (não em "</Button>"): estender até o
  // fechamento incluiria os atributos do próprio ícone no recorte, e um
  // aria-label colocado ali por engano — a correção errada que estas issues
  // existem para barrar — passaria a asserção sempre que o prettier quebrasse
  // os atributos do ícone em linhas.
  const pattern = new RegExp(
    `<Button\\b(?:(?!<Button\\b)(?!<\\/Button>)[\\s\\S])*?<${iconTag}\\b`,
    'g'
  )
  return [...source.matchAll(pattern)].map((m) => m[0])
}

describe('DeleteButton — gatilho de exclusão com nome acessível (#126)', () => {
  const source = readFileSync(join(process.cwd(), 'components/ui/delete-button.tsx'), 'utf-8')
  const gatilhos = findButtonsWithIcon(source, 'Trash2')

  it('tem exatamente um <Button> envolvendo um <Trash2>', () => {
    expect(gatilhos).toHaveLength(1)
  })

  it('expõe aria-label no <Button> do gatilho, não no ícone', () => {
    // Nenhum elemento entre o <Button> e o ícone: garante que o aria-label
    // encontrado é atributo do próprio botão, não de um wrapper interno
    // (ex: um Tooltip envolvendo o Trash2).
    expect(gatilhos.every((g) => (g.match(/</g) ?? []).length === 2)).toBe(true)
    // Prende a expressão a `title`, não a "alguma expressão": os call sites
    // usam `title` para diferenciar o rótulo por tela, e qualquer outra prop
    // do componente (`errorMessage`, por exemplo) satisfaria um regex genérico
    // enquanto rende aria-label={undefined} em runtime — React omite o
    // atributo e o gatilho volta ao name="" medido na #126.
    //
    // Sem âncora de linha de propósito: exigir o atributo em linha própria
    // deixaria o gate vermelho sobre um gatilho correto que o prettier tenha
    // colapsado numa linha só (cabe em 100 colunas com menos props).
    expect(gatilhos.every((g) => /\baria-label=\{title\}/.test(g))).toBe(true)
  })

  it('a prop title tem default — o rótulo não vira undefined nos call sites sem title', () => {
    // aria-label={title} só nomeia de verdade se `title` tiver um valor em
    // runtime. 6 dos 8 pontos de render não passam `title` (dependem
    // inteiramente do default); sem ele, aria-label={undefined} faz o React
    // omitir o atributo e o gatilho volta a ficar sem nome acessível — e as
    // duas asserções acima continuam verdes, porque `aria-label={title}` é
    // sintaticamente idêntico com ou sem default.
    expect(source).toMatch(/^\s*title = '[^']+',$/m)
  })
})

describe('Lápis de editar — cadastro (#127)', () => {
  const cases = [
    {
      name: 'CategoryDialog — editar categoria',
      path: 'components/categorias/CategoryDialog.tsx',
    },
    {
      name: 'GroupDialog — editar grupo',
      path: 'components/categorias/GroupDialog.tsx',
    },
    {
      name: 'AccountDialog — editar conta',
      path: 'components/contas/AccountDialog.tsx',
    },
  ]

  for (const { name, path } of cases) {
    describe(name, () => {
      const source = readFileSync(join(process.cwd(), path), 'utf-8')
      const gatilhos = findButtonsWithIcon(source, 'Pencil')

      it('tem exatamente um <Button> envolvendo um <Pencil>', () => {
        expect(gatilhos).toHaveLength(1)
      })

      it('expõe aria-label no <Button> do gatilho, não no ícone', () => {
        // Nenhum elemento entre o <Button> e o ícone: garante que o aria-label
        // encontrado é atributo do próprio botão, não de um wrapper interno
        // nem de um <Button> anterior que o recorte atravessou.
        expect(gatilhos.every((g) => (g.match(/</g) ?? []).length === 2)).toBe(true)
        expect(gatilhos.every((g) => /^\s*aria-label="[^"]+"$/m.test(g))).toBe(true)
      })
    })
  }
})

// ─── Lápis de editar — metas, orçamento e investimentos (#128) ─────────────
//
// Os três componentes desta fatia têm mais de um <Button> no mesmo trecho
// (ternário de 2 ou 3 braços), então uma asserção genérica sobre o arquivo
// passaria com qualquer um deles rotulado, deixando o lápis de editar intacto.

describe('Lápis de editar — metas, orçamento e investimentos (#128)', () => {
  const cases = [
    {
      name: 'InvestmentEntryDialog — editar registro (site 2)',
      path: 'components/investimentos/InvestmentEntryDialog.tsx',
      rotulo: 'Editar registro',
    },
    {
      name: 'BudgetOverrideDialog — editar orçamento (site 6)',
      path: 'components/configuracao-mes/BudgetOverrideDialog.tsx',
      rotulo: 'Editar orçamento',
    },
    {
      name: 'GoalDialog — editar meta (site 7)',
      path: 'components/metas/GoalDialog.tsx',
      rotulo: 'Editar meta',
    },
  ]

  for (const { name, path, rotulo } of cases) {
    describe(name, () => {
      const source = readFileSync(join(process.cwd(), path), 'utf-8')
      const gatilhos = findButtonsWithIcon(source, 'Pencil')

      it('tem exatamente um <Button> envolvendo um <Pencil>', () => {
        expect(gatilhos).toHaveLength(1)
      })

      it('expõe o rótulo esperado no <Button> do gatilho, não no ícone', () => {
        // Nenhum elemento entre o <Button> e o ícone: garante que o aria-label
        // encontrado é atributo do próprio botão, não de um wrapper interno
        // nem de um <Button> anterior que o recorte atravessou.
        expect(gatilhos.every((g) => (g.match(/</g) ?? []).length === 2)).toBe(true)
        expect(gatilhos[0]).toMatch(new RegExp(`^\\s*aria-label="${rotulo}"$`, 'm'))
      })

      it('nenhum outro ramo do ternário usa o mesmo rótulo', () => {
        expect(source.match(new RegExp(`aria-label="${rotulo}"`, 'g'))).toHaveLength(1)
      })
    })
  }
})

// ─── SplitSection — dois "X" idênticos sem nome acessível (#129) ──────────
//
// `lucide-react@1.8.0` (pinado em package.json) marca o <svg> do ícone como
// aria-hidden="true" quando não recebe filho nem prop de a11y — sem
// aria-label no <Button>, o role=button chega ao leitor de tela sem nome.
//
// SplitSection.tsx tem 5 <Button> no total (o "Dividir com alguém", os dois
// <X>, e mais dois no rodapé), e os dois sites em risco usam o mesmo ícone
// <X> — um `toMatch(/aria-label/)` genérico sobre o arquivo passaria com
// qualquer um deles rotulado, e um recorte que pegue só a primeira
// ocorrência deixaria o segundo site descoberto. O gate precisa: (1) achar
// os dois <Button> que envolvem um <X>, (2) exigir aria-label em ambos, e
// (3) exigir que os rótulos sejam distintos — o defeito original é a
// ambiguidade entre "fechar tudo" e "remover uma pessoa", não a ausência
// isolada de nome.

const splitSection = readFileSync(
  join(process.cwd(), 'components/forms/transaction/SplitSection.tsx'),
  'utf-8'
)

describe('SplitSection — os dois botões "X" têm nomes distintos (#129)', () => {
  const gatilhos = findButtonsWithIcon(splitSection, 'X')

  it('tem exatamente dois <Button> envolvendo um <X>', () => {
    expect(gatilhos).toHaveLength(2)
  })

  it('cada gatilho tem aria-label, e os dois rótulos são distintos', () => {
    const rotulos = gatilhos.map((g) => g.match(/^\s*aria-label="([^"]+)"$/m)?.[1])

    // Nenhum elemento entre o <Button> e o ícone: garante que o aria-label
    // encontrado é atributo do próprio botão, não de um wrapper interno.
    expect(gatilhos.every((g) => (g.match(/</g) ?? []).length === 2)).toBe(true)
    expect(rotulos.every(Boolean)).toBe(true)
    expect(new Set(rotulos).size).toBe(rotulos.length)
  })
})

// ─── Gate repo-wide: nenhum botão só de ícone sem nome (#131) ──────────────
//
// As asserções acima ancoram em 9 sites conhecidos e só protegem esses. Este
// gate varre `components/` e `app/` inteiros: todo <button>/<Button> cujo
// corpo é só ícone(s) auto-fechado(s) precisa de aria-label, aria-labelledby
// ou title na tag de abertura. (Um filho `sr-only` já tira o botão da lista:
// o <span> com texto não é ícone.)
//
// O parser anda caractere a caractere pela tag de abertura respeitando `{}` e
// aspas. A regex `<Button([^>]*?)>` fecha a tag no `>` da arrow function de
// `onClick={() => removePerson(uid)}` (SplitSection) e classifica o botão como
// "com texto" — falso negativo exatamente num dos sites que o gate trava.
//
// Limite conhecido: corpo com ícone dentro de expressão (`{a ? <X /> : <Y />}`)
// sobra `{a ? : }` como resto e não é tratado como só-ícone. Nenhum site atual
// usa isso; se aparecer, estender `soIcones`.

interface TagAberta {
  nome: string
  fimTag: number // índice logo após o `>` que fecha a tag de abertura
  attrs: string
  autoFechada: boolean
}

function lerTagAberta(src: string, inicio: number): TagAberta | null {
  const m = /^<([A-Za-z][\w.]*)/.exec(src.slice(inicio))
  if (!m) return null
  let i = inicio + m[0].length
  let chaves = 0
  let aspas: string | null = null
  const attrsDe = i
  for (; i < src.length; i++) {
    const c = src[i]
    if (aspas) {
      if (c === '\\') i++
      else if (c === aspas) aspas = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') aspas = c
    else if (c === '{') chaves++
    else if (c === '}') chaves--
    else if (c === '>' && chaves === 0) {
      const attrs = src.slice(attrsDe, i)
      const autoFechada = attrs.trimEnd().endsWith('/')
      return { nome: m[1], fimTag: i + 1, attrs, autoFechada }
    }
  }
  return null
}

// Remove componentes auto-fechados (`<Pencil className="..." />`) e devolve o resto.
function semIconesAutoFechados(corpo: string): string {
  let resto = ''
  let i = 0
  while (i < corpo.length) {
    if (corpo[i] === '<' && /[A-Z]/.test(corpo[i + 1] ?? '')) {
      const tag = lerTagAberta(corpo, i)
      if (tag?.autoFechada) {
        i = tag.fimTag
        continue
      }
    }
    resto += corpo[i++]
  }
  return resto
}

function encontrarBotoesSemNome(source: string): number[] {
  const linhas: number[] = []
  // Inclui Close/Trigger dos primitivos Radix, que renderizam <button> (ex.: o X do DialogContent).
  const abertura = /<(button|Button|[A-Z]\w*Primitive\.(?:Close|Trigger))(?=[\s>/])/g
  for (const m of source.matchAll(abertura)) {
    const tag = lerTagAberta(source, m.index)
    if (!tag || tag.autoFechada) continue
    // Fecha no </Button> correspondente, contando aninhamento do mesmo nome.
    const nome = tag.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`<${nome}(?=[\\s>/])|</${nome}>`, 'g')
    re.lastIndex = tag.fimTag
    let nivel = 1
    let fimCorpo = -1
    for (let r = re.exec(source); r; r = re.exec(source)) {
      nivel += r[0].startsWith('</') ? -1 : 1
      if (nivel === 0) {
        fimCorpo = r.index
        break
      }
    }
    if (fimCorpo < 0) continue
    const corpo = source.slice(tag.fimTag, fimCorpo)
    const soIcones = /<[A-Z]/.test(corpo) && semIconesAutoFechados(corpo).trim() === ''
    if (!soIcones) continue
    if (/\b(aria-label|aria-labelledby|title)\s*=/.test(tag.attrs)) continue
    linhas.push(source.slice(0, m.index).split('\n').length)
  }
  return linhas
}

function listarTsx(dir: string): string[] {
  return readdirSync(join(process.cwd(), dir), { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name.endsWith('.tsx'))
    .map((e) => join(e.parentPath, e.name))
}

describe('Gate repo-wide — botão só de ícone tem nome acessível (#131)', () => {
  describe('detector (fixtures)', () => {
    it('acusa botão só de ícone sem nome', () => {
      expect(encontrarBotoesSemNome('<Button size="icon"><X className="h-4" /></Button>')).toEqual([
        1,
      ])
    })

    it('acusa quando o onClick tem arrow function (o `>` que engana a regex ingênua)', () => {
      const src = `<Button\n  variant="ghost"\n  onClick={() => removePerson(entry.uid)}\n>\n  <X className="h-4" />\n</Button>`
      expect(encontrarBotoesSemNome(src)).toEqual([1])
    })

    it('aceita aria-label, aria-labelledby e title na tag de abertura', () => {
      for (const attr of ['aria-label="Fechar"', 'aria-labelledby="x"', 'title="Fechar"']) {
        expect(encontrarBotoesSemNome(`<Button ${attr}><X /></Button>`)).toEqual([])
      }
    })

    it('não aceita aria-label colocado no ícone em vez do botão', () => {
      expect(encontrarBotoesSemNome('<Button><X aria-label="Fechar" /></Button>')).toEqual([1])
    })

    it('ignora botão com texto, com sr-only ou com ícone + texto', () => {
      expect(encontrarBotoesSemNome('<button><X /> Fechar</button>')).toEqual([])
      expect(
        encontrarBotoesSemNome('<button><X /><span className="sr-only">Fechar</span></button>')
      ).toEqual([])
      expect(encontrarBotoesSemNome('<Button><Plus />{label}</Button>')).toEqual([])
    })

    it('trata botões aninhados pelo fechamento correto', () => {
      const src = '<Button aria-label="a"><X /></Button>\n<Button><Y /></Button>'
      expect(encontrarBotoesSemNome(src)).toEqual([2])
    })
  })

  it('nenhum <button>/<Button> só de ícone sem nome em components/ e app/', () => {
    const infratores: string[] = []
    for (const arquivo of [...listarTsx('components'), ...listarTsx('app')]) {
      const source = readFileSync(arquivo, 'utf-8')
      for (const linha of encontrarBotoesSemNome(source)) {
        infratores.push(`${relative(process.cwd(), arquivo)}:${linha}`)
      }
    }
    expect(infratores).toEqual([])
  })

  it('controle positivo: o X do DialogContent (sr-only) é examinado e não é acusado', () => {
    const dialog = readFileSync(join(process.cwd(), 'components/ui/dialog.tsx'), 'utf-8')
    expect(encontrarBotoesSemNome(dialog)).toEqual([])
    // Sem o sr-only o detector tem de acusar — senão o controle passa com o detector cego.
    const semNome = dialog.replace(/<span className="sr-only">Fechar<\/span>/, '')
    expect(semNome).not.toBe(dialog)
    expect(encontrarBotoesSemNome(semNome)).not.toEqual([])
  })

  it('fixture: DialogPrimitive.Close só de ícone é acusado', () => {
    expect(
      encontrarBotoesSemNome('<DialogPrimitive.Close className="x"><X /></DialogPrimitive.Close>')
    ).toEqual([1])
  })
})
