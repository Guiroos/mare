import type { Metadata } from 'next'
import { LegalPage, LegalSection } from '@/components/marketing/LegalPage'

export const metadata: Metadata = {
  title: 'Política de Privacidade — Maré',
  description:
    'O que o Maré coleta, o que é criptografado, com quem compartilha e como apagar tudo. Banco de dados e aplicação hospedados no Brasil.',
  alternates: { canonical: '/privacidade' },
}

export default function PrivacidadePage() {
  return (
    <LegalPage
      title="Política de Privacidade"
      updatedAt="15 de agosto de 2026"
      intro="Esta política diz o que o Maré guarda, o que é criptografado, com quem compartilha e o que você pode fazer a respeito. Ela é específica de propósito: em vez de prometer que “seus dados estão seguros”, ela nomeia os campos, o algoritmo e as exceções."
    >
      <LegalSection id="controlador" title="1. Quem responde por estes dados">
        <p>
          O Maré é operado por <strong>Guilherme Roos Ribeiro</strong>, pessoa física, na condição
          de controlador dos seus dados pessoais nos termos da Lei 13.709/2018 (LGPD).
        </p>
        <p>
          Contato para qualquer assunto desta política, inclusive para exercer os direitos da seção
          8: <a href="mailto:guilherme.roosr@gmail.com">guilherme.roosr@gmail.com</a>.
        </p>
      </LegalSection>

      <LegalSection id="coleta" title="2. O que é coletado">
        <p>Três origens, e nenhuma outra.</p>
        <ul>
          <li>
            <strong>Do seu login Google:</strong> nome, endereço de e-mail e foto de perfil. O Maré
            não pede senha e não tem como obtê-la.
          </li>
          <li>
            <strong>Do que você digita:</strong> lançamentos, categorias, contas de pagamento,
            parcelas, investimentos, metas, devedores e as anotações que você fizer.
          </li>
          <li>
            <strong>Gerado automaticamente:</strong> data de criação da conta e dos registros e, se
            você enviar feedback, a rota de onde ele partiu.
          </li>
        </ul>
        <p>
          Não há coleta de dados bancários. O Maré não usa Open Finance, não pede credencial de
          banco e não lê extrato — como não existe essa conexão, não existe esse dado.
        </p>
      </LegalSection>

      <LegalSection id="criptografia" title="3. O que é criptografado e o que não é">
        <p>
          Os campos com conteúdo financeiro ou pessoal são criptografados individualmente antes de
          chegar ao banco, com <strong>AES-256-GCM</strong> e uma chave distinta para cada usuário.
          Isso cobre valores, descrições, nomes de categoria, de conta e de pessoa, telefones,
          e-mails de devedores, anotações, metas, investimentos e mensagens de feedback.
        </p>
        <p>
          Ficam <strong>sem criptografia</strong> o seu nome e o seu e-mail, porque o login precisa
          procurar por eles para te reconhecer, além das datas de criação e dos identificadores
          internos dos registros.
        </p>
        <p>
          A consequência prática é a que importa: uma cópia bruta do banco não entrega seus valores.
          As linhas estão lá; o conteúdo delas, não.
        </p>
      </LegalSection>

      <LegalSection id="base-legal" title="4. Com que fundamento">
        <p>
          O tratamento dos dados da sua conta e dos seus lançamentos se dá para{' '}
          <strong>execução do contrato</strong> (art. 7º, V da LGPD) — sem eles não existe o
          serviço. A medição de audiência das páginas públicas se dá por{' '}
          <strong>legítimo interesse</strong> (art. 7º, IX).
        </p>
        <p>
          Nada aqui depende do seu consentimento, e é por isso que o Maré não exibe janela de
          cookies: não há o que consentir.
        </p>
      </LegalSection>

      <LegalSection id="compartilhamento" title="5. Com quem os dados são compartilhados">
        <p>Três fornecedores de infraestrutura, cada um com um papel restrito:</p>
        <ul>
          <li>
            <strong>Google</strong> — autenticação. Recebe apenas o necessário para confirmar que
            você é você. É o Google que valida sua senha, não o Maré.
          </li>
          <li>
            <strong>Neon</strong> — banco de dados. Armazena os registros, em sua maioria
            criptografados conforme a seção 3.
          </li>
          <li>
            <strong>Vercel</strong> — hospedagem da aplicação e medição de audiência das páginas
            públicas.
          </li>
        </ul>
        <p>
          Nenhum deles recebe seus dados para uso próprio. Não há venda, aluguel nem
          compartilhamento com anunciantes, corretoras, bureaus de crédito ou qualquer terceiro fora
          desta lista.
        </p>
      </LegalSection>

      <LegalSection id="localizacao" title="6. Onde os dados ficam">
        <p>
          O banco de dados fica em <strong>São Paulo</strong> e a aplicação roda em{' '}
          <strong>Guarulhos</strong>. Seus lançamentos não saem do Brasil.
        </p>
        <p>
          Há transferência internacional em dois pontos, ambos limitados: o login passa pelo Google,
          e a medição de audiência das páginas públicas é processada pela Vercel fora do país.
          Nenhum dos dois envolve seus dados financeiros.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="7. Cookies">
        <p>
          O Maré usa <strong>apenas cookies estritamente necessários</strong>, todos ligados à
          autenticação: o de sessão, que mantém você conectado entre páginas, e os que protegem e
          conduzem o login em si — proteção contra CSRF e os valores temporários que o fluxo do
          Google usa para voltar à página certa. Não há cookie de publicidade nem de perfilamento.
        </p>
        <p>
          A medição de audiência não usa cookies e não acompanha você entre sites — ela conta
          visitas, origem e tipo de dispositivo, sem identificar quem você é.
        </p>
      </LegalSection>

      <LegalSection id="direitos" title="8. Seus direitos">
        <p>
          A LGPD garante confirmação de tratamento, acesso, correção, portabilidade, eliminação e
          informação sobre compartilhamento (art. 18). Dois deles não dependem de você pedir nada a
          ninguém:
        </p>
        <ul>
          <li>
            <strong>Exportar tudo</strong> — em Configurações, você baixa a conta inteira em
            planilha ou CSV, a qualquer momento.
          </li>
          <li>
            <strong>Apagar tudo</strong> — também em Configurações, e o efeito é imediato. Veja a
            seção 10.
          </li>
        </ul>
        <p>
          Para os demais direitos, escreva para{' '}
          <a href="mailto:guilherme.roosr@gmail.com">guilherme.roosr@gmail.com</a>.
        </p>
      </LegalSection>

      <LegalSection id="terceiros" title="9. Dados de outras pessoas">
        <p>
          A seção de devedores permite registrar quem te deve — nome, telefone, valores e anotações.
          Essas pessoas não são usuárias do Maré e não concordaram com nada.
        </p>
        <p>
          Nesse caso, <strong>quem decide sobre aquele dado é você</strong>: você determina o que
          cadastrar, por quanto tempo manter e se vai gerar um link público de extrato. O Maré
          apenas armazena, na condição de operador. O link público, quando você o cria, torna aquele
          extrato acessível a qualquer pessoa que tenha a URL — e você pode revogá-lo quando quiser.
        </p>
        <p>
          Se você é uma dessas pessoas e quer que seus dados sejam removidos, procure quem fez o
          cadastro. Se isso não for possível, escreva para{' '}
          <a href="mailto:guilherme.roosr@gmail.com">guilherme.roosr@gmail.com</a>.
        </p>
      </LegalSection>

      <LegalSection id="retencao" title="10. Por quanto tempo">
        <p>
          Seus dados existem enquanto a sua conta existir. Quando você a exclui, a remoção é
          imediata e definitiva: não há lixeira, não há período de carência e não fica cópia
          “anonimizada” para estatística.
        </p>
        <p>
          Backups operacionais do banco expiram sozinhos em até 30 dias. Se quiser guardar seu
          histórico, exporte antes de excluir — depois não há como recuperar.
        </p>
      </LegalSection>

      <LegalSection id="alteracoes" title="11. Alterações nesta política">
        <p>
          Mudanças passam a valer na data indicada no topo. Se alguma alterar de forma relevante o
          que é coletado ou com quem é compartilhado, o aviso virá no próprio aplicativo, antes de
          entrar em vigor.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
