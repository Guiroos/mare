import type { Metadata } from 'next'
import { ComparisonTable } from '@/components/marketing/ComparisonTable'
import { Eyebrow } from '@/components/marketing/Eyebrow'
import { FaqSection } from '@/components/marketing/FaqSection'
import { MarketingButton } from '@/components/marketing/MarketingButton'
import { StructuredData } from '@/components/marketing/StructuredData'
import { TideChart } from '@/components/marketing/TideChart'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

const PILLARS = [
  {
    eyebrow: 'Parcelamento',
    title: 'Cartão não é conta corrente',
    body: 'Compra parcelada em 10x não é um gasto de hoje. É um compromisso dos próximos 10 meses. O Maré agrupa por fatura, com fechamento e vencimento, e mostra quanto do seu mês já está comprometido antes de você gastar de novo.',
    mark: (
      <>
        <rect x="1" y="3" width="30" height="20" rx="3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M1 10h30" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M36 14v16M41 18v12M31 22v8"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity=".5"
        />
      </>
    ),
  },
  {
    eyebrow: 'Privacidade',
    title: 'Seu banco continua sendo seu',
    body: 'Sem Open Finance, sem credencial bancária, sem sincronização automática. Você registra o que gastou em menos de 30 segundos e pronto. Menos mágica, mais controle — e nenhum dado seu circulando fora daqui.',
    mark: (
      <>
        <path d="M14 17V11a6 6 0 0 1 12 0v6" stroke="currentColor" strokeWidth="1.6" />
        <rect x="9" y="17" width="22" height="15" rx="3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M20 23v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  {
    eyebrow: 'Histórico',
    title: 'Janeiro não apaga dezembro',
    body: 'Planilha zera na virada do ano. O Maré não. Compare qualquer mês com qualquer outro, de qualquer ano, sem abrir arquivo antigo nem perder contexto.',
    mark: (
      <>
        <path d="M2 26h40" stroke="currentColor" strokeWidth="1.6" opacity=".4" />
        <path
          d="M2 20c6 0 6-12 12-12s6 12 12 12 6-12 12-12"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path d="M14 26v6M26 26v6" stroke="currentColor" strokeWidth="1.6" opacity=".4" />
      </>
    ),
  },
]

const FEATURES = [
  {
    title: 'Metas com progresso automático',
    body: 'Defina o objetivo, o Maré calcula quanto falta e em quanto tempo você chega no ritmo atual.',
  },
  {
    title: 'Despesas compartilhadas',
    body: 'Divida contas com quem mora com você sem virar planilha paralela no WhatsApp.',
  },
  {
    title: 'Funciona no navegador',
    body: 'Celular, notebook, o que estiver na mão. Sem instalar nada.',
  },
  {
    title: 'Seus dados são seus',
    /* PROMESSA SEM LASTRO — segunda ocorrência, ver docs/seo-landing-backlog.md
       §6.1 e o comentário em FaqSection.tsx. Export é parcial e exclusão de
       conta não existe. Quem for corrigir a copy precisa mexer nos dois
       pontos: o FAQ e aqui. */
    body: 'Exporte tudo em CSV quando quiser. Apague a conta quando quiser.',
  },
]

const STATS = [
  { label: 'Mês atual', value: '+ R$ 4.380', tone: 'text-positive' },
  { label: 'Média 12 meses', value: '+ R$ 1.770', tone: 'text-text-primary' },
  { label: 'Comprometido em parcelas', value: 'R$ 2.140', tone: 'text-negative' },
]

export default function LandingPage() {
  return (
    <>
      <StructuredData />

      {/* ── Hero ── */}
      <section className="pb-0 pt-[clamp(48px,7vw,84px)]">
        <div className="mx-auto max-w-[1120px] px-5 sm:px-8 lg:px-10">
          <Eyebrow>Beta aberto · Feito no Brasil</Eyebrow>
          <h1 className="max-w-[14ch] text-balance text-mkt-hero text-text-primary">
            Suas finanças têm ritmo. Sua{' '}
            <span className="font-normal text-accent-text opacity-90">planilha</span> não acompanha.
          </h1>
          <p className="mt-5 max-w-[52ch] text-pretty text-mkt-lead text-text-secondary">
            Maré é controle financeiro pessoal para quem já tenta se organizar e cansou da planilha.
            Registro em 30 segundos, parcelas projetadas por fatura, histórico que nunca zera.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <MarketingButton href="/login" size="lg">
              Criar conta grátis
            </MarketingButton>
            <MarketingButton href="#diferenciais" variant="ghost" size="lg">
              Ver como funciona
            </MarketingButton>
          </div>
          <p className="mt-3.5 text-mkt-micro text-text-tertiary">
            Grátis durante o beta. Entra com a conta Google, sem senha nova.
          </p>

          {/* Elemento-assinatura: a curva de saldo como tábua de maré */}
          <figure className="mb-0 mt-[clamp(44px,6vw,72px)] overflow-hidden rounded-lg border border-border bg-bg-surface shadow-lg">
            <figcaption className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2.5 border-b border-border px-5 py-4">
              <span className="font-mono text-mkt-eyebrow uppercase text-text-tertiary">
                Saldo mensal · últimos 12 meses
              </span>
              <span className="flex gap-4 text-caption text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <span className="block h-2 w-2 rounded-sm bg-positive" />
                  Maré alta
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="block h-2 w-2 rounded-sm bg-negative" />
                  Maré baixa
                </span>
              </span>
            </figcaption>

            <div className="px-1.5 pt-2">
              <TideChart />
            </div>

            <dl className="flex flex-wrap border-t border-border">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="flex-1 basis-40 border-r border-border px-5 py-4 last:border-r-0"
                >
                  <dt className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-tertiary">
                    {stat.label}
                  </dt>
                  <dd className={`text-mkt-stat ${stat.tone}`}>{stat.value}</dd>
                </div>
              ))}
            </dl>
          </figure>
        </div>
      </section>

      {/* ── Três diferenciais ── */}
      <section id="diferenciais" className="py-[clamp(64px,9vw,116px)]">
        <div className="mx-auto max-w-[1120px] px-5 sm:px-8 lg:px-10">
          <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
            {PILLARS.map((pillar) => (
              <article key={pillar.title} className="bg-bg-surface p-[clamp(26px,3.4vw,38px)]">
                <svg
                  viewBox="0 0 44 34"
                  fill="none"
                  aria-hidden="true"
                  className="mb-5 h-8 text-accent opacity-90"
                >
                  {pillar.mark}
                </svg>
                <Eyebrow>{pillar.eyebrow}</Eyebrow>
                {/* h2, não h3: são três argumentos de topo, irmãos das demais
                    seções. Como h3 pulavam o nível depois do h1 do hero, o que
                    quebra a navegação por headings em leitor de tela. */}
                <h2 className="mb-3.5 text-balance text-mkt-h3 text-text-primary">
                  {pillar.title}
                </h2>
                <p className="text-pretty text-[16px] leading-relaxed text-text-secondary">
                  {pillar.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <hr className="border-0 border-t border-border" />

      {/* ── Funcionalidades de suporte ── */}
      <section className="py-[clamp(64px,9vw,116px)]">
        <div className="mx-auto max-w-[1120px] px-5 sm:px-8 lg:px-10">
          <Eyebrow>Também vem junto</Eyebrow>
          <h2 className="mb-[clamp(32px,4vw,52px)] max-w-[20ch] text-balance text-mkt-h2 text-text-primary">
            O resto do que uma planilha nunca fez sozinha.
          </h2>
          <div className="grid gap-[clamp(24px,3.4vw,40px)] md:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="border-t border-border pt-5">
                <h3 className="mb-1.5 text-[17px] font-semibold leading-snug text-text-primary">
                  {feature.title}
                </h3>
                <p className="text-pretty text-mkt-small text-text-secondary">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="relative overflow-hidden border-y border-border bg-bg-surface py-[clamp(64px,9vw,116px)]">
        {/* Régua de nível de cais, ecoando as marcações da tábua de maré */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-[repeating-linear-gradient(to_bottom,var(--border-strong)_0_1px,transparent_1px_28px)] opacity-70 [mask-image:linear-gradient(to_bottom,transparent,#000_25%_75%,transparent)]"
        />
        <div className="relative mx-auto max-w-[1120px] px-5 sm:px-8 lg:px-10">
          <Eyebrow>Começar</Eyebrow>
          <h2 className="max-w-[18ch] text-balance text-mkt-h2 text-text-primary">
            Crie sua conta e saia da planilha na próxima virada de mês.
          </h2>
          <div className="mt-7">
            <MarketingButton href="/login" size="lg">
              Criar conta grátis
            </MarketingButton>
          </div>
          <p className="mt-3.5 text-mkt-micro text-text-tertiary">
            Grátis durante o beta. Sem cartão de crédito, sem newsletter.
          </p>
        </div>
      </section>

      <FaqSection />

      <hr className="border-0 border-t border-border" />

      <ComparisonTable />
    </>
  )
}
