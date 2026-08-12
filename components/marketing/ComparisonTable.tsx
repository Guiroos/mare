import { Eyebrow } from './Eyebrow'

/**
 * Comparação honesta: inclui a linha em que o Maré perde (tempo de registro
 * contra sincronização automática). Tabela que só mostra dimensões favoráveis
 * é lida como propaganda e converte pior no público-alvo desta página, que já
 * usou e abandonou pelo menos um app do ramo.
 */
const ROWS = [
  {
    label: 'Acesso à conta bancária',
    planilha: 'Não',
    openFinance: 'Sim',
    mare: 'Não',
  },
  {
    label: 'Parcelas agrupadas por fatura',
    planilha: 'Manual e trabalhoso',
    openFinance: 'Varia',
    mare: 'Automático',
  },
  {
    label: 'Histórico entre anos',
    planilha: 'Zera ou fragmenta',
    openFinance: 'Varia',
    mare: 'Contínuo',
  },
  {
    label: 'Tempo para registrar um gasto',
    planilha: '1–2 min',
    openFinance: 'Automático',
    mare: '~30s',
  },
  {
    label: 'Gasto em dinheiro ou PIX de terceiro',
    planilha: 'Manual',
    openFinance: 'Não aparece',
    mare: 'Registro normal',
  },
  {
    label: 'Funciona sem conexão com banco',
    planilha: 'Sim',
    openFinance: 'Não',
    mare: 'Sim',
  },
]

export function ComparisonTable() {
  return (
    <section className="py-[clamp(64px,9vw,116px)]">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-8 lg:px-10">
        <Eyebrow>Comparação honesta</Eyebrow>
        <h2 className="mb-[clamp(28px,3.4vw,40px)] text-mkt-h2 text-text-primary">
          Onde o Maré fica diferente
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-[15px] tabular-nums">
            <thead>
              <tr>
                <th scope="col" className="w-1/3" />
                <th
                  scope="col"
                  className="border-b border-border-strong px-4 py-4 text-left font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-text-tertiary"
                >
                  Planilha
                </th>
                <th
                  scope="col"
                  className="border-b border-border-strong px-4 py-4 text-left font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-text-tertiary"
                >
                  Apps com Open Finance
                </th>
                <th
                  scope="col"
                  className="border-b border-border-strong bg-accent-subtle px-4 py-4 text-left text-[16px] font-semibold tracking-tight text-accent-text"
                >
                  Maré
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <th
                    scope="row"
                    className="border-b border-border px-4 py-4 text-left align-top font-medium text-text-primary last:border-b-0"
                  >
                    {row.label}
                  </th>
                  <td className="border-b border-border px-4 py-4 align-top text-text-secondary">
                    {row.planilha}
                  </td>
                  <td className="border-b border-border px-4 py-4 align-top text-text-secondary">
                    {row.openFinance}
                  </td>
                  <td className="border-b border-border bg-accent-subtle px-4 py-4 align-top font-medium text-accent-text">
                    {row.mare}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
