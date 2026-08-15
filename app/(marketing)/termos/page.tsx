import type { Metadata } from 'next'
import { LegalPage, LegalSection } from '@/components/marketing/LegalPage'

export const metadata: Metadata = {
  title: 'Termos de Uso — Maré',
  description:
    'As regras de uso do Maré: o que ele é e o que não é, o que é gratuito, suas responsabilidades e como encerrar a conta.',
  alternates: { canonical: '/termos' },
}

export default function TermosPage() {
  return (
    <LegalPage
      title="Termos de Uso"
      updatedAt="15 de agosto de 2026"
      intro="Ao usar o Maré você concorda com o que está aqui. São poucas regras, e a maior parte delas existe para deixar claro o que o Maré não faz."
    >
      <LegalSection id="o-que-e" title="1. O que o Maré é">
        <p>
          O Maré é uma ferramenta para registrar e organizar finanças pessoais. Você anota o que
          entrou e o que saiu, e ele mostra o quadro.
        </p>
        <p>
          O Maré <strong>não é consultoria financeira</strong> e não recomenda investimento. Ele não
          executa transação, não movimenta dinheiro, não se conecta ao seu banco e não tem qualquer
          acesso às suas contas. As decisões sobre o seu dinheiro são suas, e o resultado delas
          também.
        </p>
      </LegalSection>

      <LegalSection id="quem-pode" title="2. Quem pode usar">
        <p>
          Você precisa ter 18 anos ou mais e uma conta Google válida. Uma conta do Maré pertence a
          uma pessoa — os dados são pessoais e não foram desenhados para uso compartilhado.
        </p>
      </LegalSection>

      <LegalSection id="custo" title="3. Quanto custa">
        <p>
          O Maré é <strong>gratuito</strong>. Não há plano pago, cobrança escondida nem período de
          teste que vira assinatura.
        </p>
        <p>
          Se um dia isso mudar, você será avisado com antecedência e{' '}
          <strong>nada será cobrado sem que você aceite</strong>. Quem não aceitar continua podendo
          exportar tudo e encerrar a conta.
        </p>
      </LegalSection>

      <LegalSection id="responsabilidades" title="4. Suas responsabilidades">
        <ul>
          <li>
            <strong>Sua conta Google é a única porta de entrada.</strong> Quem tiver acesso a ela
            tem acesso ao seu Maré. Mantenha-a protegida.
          </li>
          <li>
            <strong>Dados de outras pessoas.</strong> Ao cadastrar um devedor, você declara ter
            motivo legítimo para tratar aquele dado e responde por ele. O mesmo vale ao gerar um
            link público de extrato: a decisão de expor é sua, e o link é acessível a quem tiver a
            URL.
          </li>
          <li>
            <strong>O que você registra.</strong> O Maré não confere nem corrige o que você digita.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="vedacoes" title="5. O que você não pode fazer">
        <ul>
          <li>Tentar acessar dados de outro usuário, por qualquer meio.</li>
          <li>Automatizar acesso ao serviço, raspar conteúdo ou sobrecarregar a infraestrutura.</li>
          <li>Revender o acesso ou oferecer o Maré como se fosse serviço seu.</li>
        </ul>
      </LegalSection>

      <LegalSection id="disponibilidade" title="6. Disponibilidade">
        <p>
          O Maré é oferecido “como está”, sem garantia de disponibilidade. É um serviço gratuito
          mantido por uma pessoa: pode sair do ar para manutenção, apresentar falhas ou ser
          descontinuado.
        </p>
        <p>
          <strong>
            Se for descontinuado, você será avisado com antecedência razoável e a exportação
            continuará funcionando até o último dia.
          </strong>{' '}
          Seu histórico não fica preso aqui.
        </p>
      </LegalSection>

      <LegalSection id="encerramento" title="7. Encerramento">
        <p>
          Você pode excluir sua conta a qualquer momento, em Configurações. A exclusão é imediata e
          irreversível — exporte antes se quiser guardar o histórico.
        </p>
        <p>
          Contas que violem estes termos, especialmente a seção 5, podem ser encerradas. Sempre que
          possível, com aviso prévio.
        </p>
      </LegalSection>

      <LegalSection id="responsabilidade" title="8. Limitação de responsabilidade">
        <p>
          O Maré organiza informação que você mesmo registrou. Não há responsabilidade por decisões
          financeiras tomadas a partir do que ele exibe, por perda de dados decorrente de exclusão
          feita por você, nem por indisponibilidade do serviço.
        </p>
        <p>
          Isso não afasta as responsabilidades que a lei brasileira não permite afastar, inclusive
          as do Código de Defesa do Consumidor.
        </p>
      </LegalSection>

      <LegalSection id="foro" title="9. Lei aplicável">
        <p>
          Estes termos são regidos pela lei brasileira. Fica eleito o foro do domicílio do usuário
          para qualquer questão que deles decorra.
        </p>
        <p>
          Dúvidas: <a href="mailto:placeholder@email.com">placeholder@email.com</a>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
