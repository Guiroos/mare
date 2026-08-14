import { Eyebrow } from './Eyebrow'

/**
 * Fonte única do FAQ: a mesma lista alimenta o `<details>` visível e o
 * JSON-LD de `FAQPage`. Separar os dois é como o schema sai de sincronia com
 * a página e o Google passa a mostrar resposta que não existe mais.
 */
const FAQ = [
  {
    q: 'O Maré acessa minha conta bancária?',
    a: 'Não. O Maré não pede credencial de banco, não usa Open Finance e não se conecta a nenhuma instituição financeira. Todo registro é feito por você.',
  },
  {
    q: 'Preciso pagar?',
    a: 'Durante o beta, não. Quando houver planos pagos, quem já está usando será avisado com antecedência.',
  },
  {
    q: 'Meus dados ficam onde?',
    /* PROMESSA SEM LASTRO — ver docs/seo-landing-backlog.md §6.1.
       "exportar tudo em CSV": resolvido em /api/export/completo, que cobre as 12
       planilhas da conta em .xlsx e .zip de CSVs.
       "apagar sua conta": ainda não existe. `resetAccount` limpa os dados e
       mantém o usuário — que é outra coisa, e não é o que esta frase promete.
       Enquanto ela não subir, metade desta resposta é afirmação falsa em
       produção. Remover este comentário só quando a exclusão de conta existir. */
    a: 'Em banco de dados gerenciado, com os campos sensíveis criptografados individualmente por uma chave exclusiva da sua conta — nem o banco de dados guarda os valores em texto legível. Você pode exportar tudo em CSV ou apagar sua conta a qualquer momento.',
  },
  {
    q: 'Dá para importar minha planilha?',
    a: 'Hoje não. A importação de planilha ainda não existe e não tem data — quando entrar no roadmap, será anunciado aqui.',
  },
  {
    q: 'Tem app para celular?',
    a: 'O Maré funciona no navegador do celular e pode ser adicionado à tela de início. App nativo não está no roadmap atual.',
  },
]

export function FaqSection() {
  return (
    <section className="py-[clamp(64px,9vw,116px)]">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-8 lg:px-10">
        <Eyebrow>Perguntas frequentes</Eyebrow>
        <h2 className="mb-[clamp(28px,3.4vw,40px)] text-mkt-h2 text-text-primary">
          Dúvidas comuns
        </h2>

        {FAQ.map((item, i) => (
          <details
            key={item.q}
            open={i === 0}
            className="group border-t border-border last:border-b"
          >
            <summary className="relative cursor-pointer list-none py-5 pr-10 text-mkt-body font-medium marker:hidden [&::-webkit-details-marker]:hidden">
              {item.q}
              <span
                aria-hidden="true"
                className="absolute right-2 top-7 h-2.5 w-2.5 rotate-45 border-b-[1.5px] border-r-[1.5px] border-text-tertiary transition duration-base group-open:-rotate-[135deg]"
              />
            </summary>
            <p className="max-w-[66ch] pb-6 text-[16px] leading-relaxed text-text-secondary">
              {item.a}
            </p>
          </details>
        ))}
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ.map((item) => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          }),
        }}
      />
    </section>
  )
}
