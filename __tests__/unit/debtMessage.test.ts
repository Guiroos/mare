import { describe, it, expect } from 'vitest'
import { buildDebtMessage } from '@/lib/utils/debtMessage'

const charges = [
  { description: 'Almoço', entryDate: '2026-05-15', amount: 80 },
  { description: 'Cinema', entryDate: '2026-05-20', amount: 40 },
]

describe('buildDebtMessage', () => {
  it('includes greeting with person name', () => {
    const msg = buildDebtMessage('João', charges, null)
    expect(msg).toContain('Olá João! 👋')
  })

  it('formats date as DD/MM/AAAA', () => {
    const msg = buildDebtMessage('João', charges, null)
    expect(msg).toContain('15/05/2026')
    expect(msg).toContain('20/05/2026')
  })

  it('includes description for each charge', () => {
    const msg = buildDebtMessage('João', charges, null)
    expect(msg).toContain('Almoço')
    expect(msg).toContain('Cinema')
  })

  it('includes bullet points', () => {
    const msg = buildDebtMessage('João', charges, null)
    expect(msg).toContain('• Almoço')
    expect(msg).toContain('• Cinema')
  })

  it('includes formatted total', () => {
    const msg = buildDebtMessage('João', charges, null)
    expect(msg).toContain('120,00')
  })

  it('includes pix key when provided', () => {
    const msg = buildDebtMessage('João', charges, 'joao@email.com')
    expect(msg).toContain('Minha chave Pix: joao@email.com')
  })

  it('omits pix line when pixKey is null', () => {
    const msg = buildDebtMessage('João', charges, null)
    expect(msg).not.toContain('Pix')
  })

  it('handles empty charges list', () => {
    const msg = buildDebtMessage('Maria', [], null)
    expect(msg).toContain('Olá Maria! 👋')
    expect(msg).toContain('Total:')
    expect(msg).toContain('0,00')
  })
})
