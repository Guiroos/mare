---
description: Roteia aprendizados da sessão para o MD correto
allowed-tools: Read, Edit, Write, Bash(git:*)
---

Atividade desta sessão:
!`git log --oneline -8`

Mudanças não commitadas:
!`git diff HEAD --stat 2>/dev/null || echo "(nenhuma)"`

Diff completo (truncado em 400 linhas):
!`git diff HEAD 2>/dev/null | head -400`

---

Leia os arquivos destino antes de extrair qualquer aprendizado:
- `CLAUDE.md` — seções Architecture e Gotchas
- `.claude/ds-components.md` — todas as seções

## Passo 1 — Extraia aprendizados candidatos

Com base no diff acima e no histórico desta conversa, liste aprendizados concretos e não-óbvios que ajudariam sessões futuras.

Descarte silenciosamente:
- Qualquer item já presente nos arquivos lidos
- Correções pontuais que dificilmente vão se repetir
- Informação derivável pelo nome do código, arquivos ou convenções óbvias do projeto
- Conteúdo genérico não específico do Maré

## Passo 2 — Classifique com roteamento explícito

Para cada aprendizado, determine o destino. Se não couber com clareza em nenhuma regra abaixo, marque como **INCERTO**.

### Destinos existentes

**`.claude/ds-components.md` → `## Gotchas de tokens e utilitários`**
Comportamento de token ou classe Tailwind, quirks de componentes Radix (rendering, backgrounds nativos), `cn()`/`twMerge`/`extendTailwindMerge`, quando usar `tabular-nums`, `preserveExplicitZero` em inputs, padrões de uso do ds-reviewer. Regra prática: se envolve token, classe CSS ou comportamento de componente do DS Maré → vai aqui.

**`.claude/ds-components.md` → `## Tabela de inventário` ou `## Hierarquia de camadas`**
Novo componente adicionado em `components/ui/`, nova prop relevante em componente DS existente, mudança de hierarquia de camadas.

**`CLAUDE.md` → `### Gotchas`**
Auth (`requireUserId`, `assertOwns*`, ordem de action), Drizzle/data layer (`toAmount`, unique indexes, migrations), conceitos de domínio (meses, billing cycles, contas), Playwright nesta aplicação, git/build/deploy, parsing de datas. Regra prática: se envolve lógica de negócio, dados ou infraestrutura → vai aqui.

### Criar novo arquivo

Quando 3 ou mais aprendizados formam um domínio coeso sem lar nos arquivos existentes (exemplos: `.claude/recharts.md`, `.claude/playwright.md`), proponha criar um novo arquivo. Se aprovado, adicione `@.claude/<domínio>.md` no `CLAUDE.md` na seção `### UI` ou onde couber.

Não crie novos arquivos por menos de 3 itens — prefira encaixar no MD mais próximo.

### Zona cinzenta — marque como INCERTO

Padrões de layout responsivo que podem ser token DS ou gotcha de UI geral, qualquer item que genuinamente se encaixa em dois destinos, qualquer item onde a confiança no roteamento é baixa.

## Passo 3 — Apresente o plano antes de escrever

Mostre a tabela completa e aguarde aprovação. Não escreva nada antes disso.

```
## Roteamento proposto

| # | Aprendizado (1 linha concisa) | Destino | Seção | Raciocínio |
|---|-------------------------------|---------|-------|------------|
| 1 | ...                           | ds-components.md | Gotchas de tokens | envolve comportamento de token Tailwind |
| 2 | ...                           | CLAUDE.md | Gotchas | padrão de auth em actions |

## Incertos — requerem decisão

| # | Aprendizado | Candidatos | Por que é ambíguo |
|---|-------------|------------|-------------------|
| 3 | ...         | ds-components.md / CLAUDE.md | layout responsivo sem token específico |

## Descartados (motivo)
- "X" — já documentado em CLAUDE.md linha N
- "Y" — correção pontual sem recorrência esperada
```

Pergunte explicitamente: há itens para reclassificar, descartar ou mover para INCERTO?

## Passo 4 — Aplique apenas o aprovado

Para cada item aprovado:
1. Releia o trecho da seção destino para confirmar posição exata
2. Adicione uma linha de bullet no final da seção — concisa, no estilo dos bullets existentes
3. Não reescreva, não reorganize, não altere conteúdo já presente

Se nenhum aprendizado for identificado ou todos forem descartados, informe e encerre sem modificar nenhum arquivo.
