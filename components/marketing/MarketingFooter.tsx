/**
 * Rodapé da landing.
 *
 * O protótipo previa links para Privacidade, Termos e Segurança. Essas páginas
 * ainda não existem (Fase 0.5 do PRD) e apontar para 404 custa mais do que a
 * ausência do link: quebra confiança justamente na parte da página onde o
 * usuário procura a letra miúda. Reintroduzir aqui assim que as rotas subirem —
 * elas são bloqueantes para abrir cadastro público de qualquer forma.
 */
export function MarketingFooter() {
  return (
    <footer className="border-t border-border pb-14 pt-11 text-[14px] text-text-tertiary">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-x-6 gap-y-3.5 px-5 sm:px-8 lg:px-10">
        <p>Maré · Feito no Brasil · © 2026</p>
      </div>
    </footer>
  )
}
