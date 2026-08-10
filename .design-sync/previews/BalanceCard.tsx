import { BalanceCard } from 'mare'

export const Completo = () => (
  <BalanceCard
    label="Saldo de agosto"
    amount="R$ 2.060,00"
    income="R$ 5.200,00"
    expense="R$ 3.140,00"
    className="max-w-md"
  />
)

export const SoSaldo = () => (
  <BalanceCard label="Patrimônio total" amount="R$ 84.310,55" className="max-w-md" />
)

export const SaldoNegativo = () => (
  <BalanceCard
    label="Saldo de julho"
    amount="− R$ 418,20"
    income="R$ 4.900,00"
    expense="R$ 5.318,20"
    className="max-w-md"
  />
)
