import { SITE_URL } from '@/lib/utils/site'

/**
 * JSON-LD da landing (T1.3 do PRD). O `FAQPage` fica em `FaqSection`, colado na
 * lista que ele descreve — separar o schema do conteúdo é como o Google passa a
 * exibir resposta que a página não tem mais.
 *
 * Só entra aqui o que a página realmente afirma. `aggregateRating` e
 * `review` renderizam estrelas no SERP e são a tentação óbvia, mas o Maré não
 * tem avaliação pública nenhuma — declarar seria dado inventado, e é a classe
 * de marcação que o Google penaliza por manual action.
 *
 * Um único `@graph` em vez de três blocos soltos: assim `SoftwareApplication`
 * pode referenciar a `Organization` por `@id` em vez de repetir os campos dela,
 * e os três não podem sair de sincronia.
 */
export function StructuredData() {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'Maré',
        url: SITE_URL,
        logo: `${SITE_URL}/icons/512`,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: 'Maré',
        url: SITE_URL,
        inLanguage: 'pt-BR',
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_URL}/#app`,
        name: 'Maré',
        url: SITE_URL,
        applicationCategory: 'FinanceApplication',
        /* "Web" e não "Any": o Maré roda no navegador e não tem app nativo — o
           FAQ da própria página diz isso. */
        operatingSystem: 'Web',
        inLanguage: 'pt-BR',
        description:
          'Controle financeiro pessoal com parcelas do cartão agrupadas por fatura, metas com progresso automático e histórico que não zera na virada do ano. Sem conexão bancária.',
        publisher: { '@id': `${SITE_URL}/#organization` },
        /* Gratuito durante o beta — o mesmo que os dois CTAs prometem. Ao
           introduzir plano pago, este bloco muda junto com a copy. */
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'BRL',
          availability: 'https://schema.org/InStock',
        },
        featureList: [
          'Parcelas do cartão projetadas por fatura',
          'Registro de gastos em menos de 30 segundos',
          'Metas com progresso automático',
          'Despesas compartilhadas',
          'Histórico permanente entre anos',
          'Exportação em CSV',
        ],
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  )
}
