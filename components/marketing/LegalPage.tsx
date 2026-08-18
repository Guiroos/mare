/**
 * Casca das páginas jurídicas (/privacidade, /termos).
 *
 * A data de atualização é obrigatória e fica no topo: a LGPD pede que mudanças
 * de política sejam rastreáveis, e sem versionamento histórico (fora de escopo
 * enquanto não há usuário pagante) a data é o único rastro que existe.
 *
 * `LegalSection` numera e ancora cada seção porque política é documento que se
 * cita por link — âncora estável vale mais aqui do que na landing.
 */
export function LegalPage({
  title,
  updatedAt,
  intro,
  children,
}: {
  title: string
  updatedAt: string
  intro: string
  children: React.ReactNode
}) {
  return (
    <article className="mx-auto max-w-[720px] px-5 pb-24 pt-14 sm:px-8 lg:px-10">
      <h1 className="text-mkt-h2 font-semibold tracking-tight text-text-primary">{title}</h1>
      <p className="mt-3 font-mono text-mkt-micro uppercase text-text-tertiary">
        Atualizada em {updatedAt}
      </p>
      <p className="mt-6 text-mkt-lead text-text-secondary">{intro}</p>
      <div className="mt-12 space-y-11">{children}</div>
    </article>
  )
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-mkt-h3 font-semibold tracking-tight text-text-primary">{title}</h2>
      <div className="mt-4 space-y-4 text-mkt-body text-text-secondary [&_a]:text-accent-text [&_a]:underline [&_li]:mt-2 [&_strong]:font-semibold [&_strong]:text-text-primary [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </section>
  )
}
