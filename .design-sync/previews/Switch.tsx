import { Switch, Card } from 'mare'

export const Estados = () => (
  <div className="flex flex-col gap-4">
    <Switch label="Modo privacidade" checked onChange={() => {}} />
    <Switch label="Modo privacidade" checked={false} onChange={() => {}} />
    <Switch label="Indisponível neste plano" checked={false} disabled onChange={() => {}} />
  </div>
)

export const EmConfiguracoes = () => (
  <Card padding="lg" className="flex max-w-sm flex-col gap-5">
    <div className="text-h3 text-text-primary">Preferências</div>
    <Switch label="Ocultar valores no dashboard" checked onChange={() => {}} />
    <Switch label="Excluir aporte do fluxo de caixa" checked={false} onChange={() => {}} />
    <Switch label="Receber resumo mensal por e-mail" checked onChange={() => {}} />
  </Card>
)

export const SemLabel = () => (
  <div className="flex items-center gap-3">
    <Switch checked onChange={() => {}} />
    <span className="text-body text-text-primary">Rótulo controlado por fora</span>
  </div>
)
