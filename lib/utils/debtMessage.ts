import { formatCurrency } from '@/lib/utils/currency'

export type ChargeForMessage = {
  description: string
  entryDate: string
  amount: number
}

export function buildDebtMessage(
  name: string,
  charges: ChargeForMessage[],
  pixKey: string | null
): string {
  const lines: string[] = [
    `Olá ${name}! 👋`,
    '',
    'Passando para lembrar dos valores em aberto:',
    '',
  ]

  let total = 0
  for (const charge of charges) {
    const [year, month, day] = charge.entryDate.split('-')
    lines.push(
      `• ${charge.description} (${day}/${month}/${year}) — ${formatCurrency(charge.amount)}`
    )
    total += charge.amount
  }

  lines.push('', `Total: ${formatCurrency(total)}`)

  if (pixKey) {
    lines.push('', `Minha chave Pix: ${pixKey}`)
  }

  return lines.join('\n')
}
