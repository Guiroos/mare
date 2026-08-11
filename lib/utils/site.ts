/**
 * Origem canônica do site. Estava repetida em `app/layout.tsx`, `app/robots.ts`
 * e `app/sitemap.ts` — três arquivos que precisam concordar sobre qual é o
 * domínio canônico, sem nada forçando isso. Divergência aqui não quebra build:
 * gera sitemap apontando para um host e canonical apontando para outro.
 *
 * O apex é o canônico (decisão T0.4 do PRD); `www` redireciona para cá.
 */
export const SITE_URL = 'https://meumare.com.br'
