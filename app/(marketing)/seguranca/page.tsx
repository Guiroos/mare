import type { Metadata } from 'next'
import { Eyebrow } from '@/components/marketing/Eyebrow'
import { MarketingButton } from '@/components/marketing/MarketingButton'

export const metadata: Metadata = {
  title: 'Segurança — Maré',
  description:
    'Como o Maré protege seus dados: sem conexão bancária, campos criptografados com chave por usuário e exclusão que apaga de verdade.',
  alternates: { canonical: '/seguranca' },
}

const BLOCKS = [
  {
    eyebrow: 'Acesso',
    title: 'Seu banco continua sendo seu',
    body: 'O Maré não usa Open Finance, não pede credencial bancária e não lê extrato. Você registra o que gastou; ele organiza. Como nunca houve acesso à sua conta, não existe cenário em que o Maré movimente seu dinheiro — nem por falha, nem por invasão.',
  },
  {
    eyebrow: 'Criptografia',
    title: 'Uma chave para cada usuário',
    body: 'Valores, descrições, nomes de categoria e de pessoas, telefones e anotações são criptografados um a um com AES-256-GCM, e cada conta tem sua própria chave. A consequência é a que importa: uma cópia bruta do banco não entrega seus valores. As linhas estão lá; o conteúdo delas, não.',
  },
  {
    eyebrow: 'Exclusão',
    title: 'Apagar apaga de verdade',
    body: 'Ao excluir a conta, tudo sai na hora: lançamentos, categorias, devedores, metas e o próprio cadastro. Não há lixeira, não há período de carência e não fica cópia “anonimizada” para estatística. Por isso a exportação completa fica ao lado do botão — leve seu histórico antes.',
  },
  {
    eyebrow: 'Hospedagem',
    title: 'Os dados ficam no Brasil',
    body: 'O banco de dados roda em São Paulo e a aplicação em Guarulhos. Seus lançamentos não saem do país; o que atravessa fronteira é apenas o login, que passa pelo Google, e a contagem de visitas das páginas públicas.',
  },
]

export default function SegurancaPage() {
  return (
    <div className="mx-auto max-w-[880px] px-5 pb-24 pt-14 sm:px-8 lg:px-10">
      <Eyebrow>Segurança</Eyebrow>
      <h1 className="text-mkt-h2 font-semibold tracking-tight text-text-primary">
        O que protege seus dados aqui
      </h1>
      <p className="mt-5 max-w-[620px] text-mkt-lead text-text-secondary">
        Todo aplicativo financeiro diz que é seguro. Esta página diz como — em termos que você pode
        conferir, e sem prometer nada que o código não faça.
      </p>

      <div className="mt-14 space-y-11">
        {BLOCKS.map((block) => (
          <section key={block.title} className="border-t border-border pt-7">
            <Eyebrow>{block.eyebrow}</Eyebrow>
            <h2 className="text-mkt-h3 font-semibold tracking-tight text-text-primary">
              {block.title}
            </h2>
            <p className="mt-3 max-w-[620px] text-mkt-body text-text-secondary">{block.body}</p>
          </section>
        ))}
      </div>

      <section className="mt-14 border-t border-border pt-7">
        <Eyebrow>Encontrou algo</Eyebrow>
        <h2 className="text-mkt-h3 font-semibold tracking-tight text-text-primary">
          Como reportar um problema
        </h2>
        <p className="mt-3 max-w-[620px] text-mkt-body text-text-secondary">
          Se você encontrou uma falha de segurança, escreva para{' '}
          <a className="text-accent-text underline" href="mailto:placeholder@email.com">
            placeholder@email.com
          </a>
          . Não há programa de recompensa, mas há resposta: todo relato é lido e respondido.
        </p>
        <div className="mt-7">
          <MarketingButton href="/login">Criar conta</MarketingButton>
        </div>
      </section>
    </div>
  )
}
