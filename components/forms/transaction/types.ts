export type FormType = 'avulso' | 'fixo' | 'parcelado' | 'entrada' | 'investimento' | 'resgate'
export type PrimaryType = 'saida' | 'entrada' | 'investimento' | 'resgate'
export type SaidaSubType = 'avulsa' | 'fixa' | 'parcelada'

export type CategoryGroup = {
  id: string
  name: string
  categories: { id: string; name: string }[]
}

export type Account = {
  id: string
  name: string
  type: string
}

export type InvestmentType = {
  id: string
  name: string
}

export type PreviewState = {
  primaryType: PrimaryType
  subType: SaidaSubType
  name: string
  amount: string
  categoryId: string
  categoryName: string
  accountId: string
  accountName: string
  excludeFromCashFlow: boolean
}
