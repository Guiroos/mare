# Upgrade Next.js 14 → 16 — Índice

Planejamento e execução do upgrade do Next.js 14.2.x para 16.x e React 18 para 19.

## Status em 24/05/2026

| Fase | Objetivo                                   | Status      |
| ---- | ------------------------------------------ | ----------- |
| 1    | Preparação e branch                        | concluída   |
| 2    | Upgrade de dependências                    | concluída   |
| 3    | Migração do PWA (@serwist/next)            | concluída   |
| 4    | Migração das Async Request APIs            | concluída   |
| 5    | Ajustes de config e limpeza                | concluída   |
| 6    | Validação e testes                         | concluída   |

---

## Decisão

Atualizar diretamente para Next.js 16 (pulando v15). Motivo: React 19 é obrigatório nos dois casos e o trabalho de migrar params/searchParams para async é mecânico — fazer em duas etapas não poupa esforço real.

A branch do Dependabot (`dependabot/npm_and_yarn/next-16.2.6`) é o ponto de partida — já tem o bump do `next` feito. O trabalho continua em cima dela, **não em uma branch nova**.

## Principais Mudanças

| Categoria             | Detalhe                                                            |
| --------------------- | ------------------------------------------------------------------ |
| Next.js               | 14.2.35 → 16.2.6                                                   |
| React                 | 18.3.1 → 19.x                                                      |
| PWA                   | `@ducanh2912/next-pwa` → `@serwist/next` + `@serwist/turbopack`   |
| Async APIs            | `params` e `searchParams` síncronos → `await` obrigatório          |
| Turbopack             | Passa a ser padrão em `next dev` e `next build`                    |
| Build script          | `next build` agora usa Turbopack por padrão                        |
| ESLint                | `next lint` removido — já usamos `eslint` direto, sem impacto      |

## Arquivos

| Arquivo                                                    | Conteúdo                                                  |
| ---------------------------------------------------------- | --------------------------------------------------------- |
| [01-breaking-changes.md](./01-breaking-changes.md)         | Inventário completo de breaking changes e impacto no app  |
| [02-roadmap.md](./02-roadmap.md)                           | Fases com checklists e critérios de aceite                |

## Referências

- `next.config.mjs` — config do Next.js e wrapper do PWA
- `package.json` — dependências
- `app/(app)/dashboard/page.tsx` — searchParams afetado
- `app/(app)/panorama/page.tsx` — searchParams afetado
- `app/(app)/configuracao-mes/page.tsx` — searchParams afetado
- `app/(app)/devedores/[id]/page.tsx` — params afetado
- `app/manifest.ts` — manifesto PWA (permanece; Serwist lê automaticamente)
